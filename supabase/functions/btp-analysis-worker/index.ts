// ============================================================================
// btp-analysis-worker
// Exécution PERSISTANTE côté serveur du parcours unifié « Analyser mon projet ».
//
// Le navigateur ne fait plus qu'ouvrir le travail (start) puis lire son état
// (status). L'enchaînement des étapes techniques (analyse documentaire →
// extraction factuelle → rapport final) est réalisé ici, chaque étape étant
// enregistrée dans public.btp_analysis_jobs. Un démontage du composant React,
// une mise en veille du téléphone, une actualisation ou une fermeture de
// l'application n'interrompent donc plus le traitement.
//
// Reprise : si la durée maximale d'exécution est atteinte, l'état est
// enregistré et une nouvelle exécution serveur est déclenchée (self-chaining).
// Chaque étape est idempotente : une étape déjà enregistrée n'est jamais
// rejouée.
// ============================================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  parseFactsBlock,
  serializeFactsContract,
  validateBtpFacts,
} from "../_shared/btpFactsContract.ts";
import {
  consolidateBtpContracts,
  serializeConsolidatedContract,
  type ContractEntry,
} from "../_shared/btpFactsConsolidation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-resume",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const AI_URL = `${SUPABASE_URL}/functions/v1/ai-assistant`;
const SELF_URL = `${SUPABASE_URL}/functions/v1/btp-analysis-worker`;

// Budget d'exécution avant enregistrement + reprise par une nouvelle exécution.
const TIME_BUDGET_MS = 95_000;
// Nombre maximal de tentatives automatiques sur erreur temporaire.
const MAX_ATTEMPTS = 3;
// Au-delà, un travail « processing » est considéré orphelin et peut reprendre.
const STALE_MS = 120_000;

const DOC_DATA_OPEN = "<ANAFYPRO_DOCUMENT_DATA>";
const DOC_DATA_CLOSE = "</ANAFYPRO_DOCUMENT_DATA>";
const FACTS_OPEN = "<ANAFYPRO_BTP_FACTS>";
const FACTS_CLOSE = "</ANAFYPRO_BTP_FACTS>";
const TRUNCATED_MARK = "<ANAFYPRO_TRUNCATED/>";

// Taille maximale d'une portion de couche texte lorsqu'un document doit être
// subdivisé, et nombre de pages par portion pour un PDF rendu en images.
const PORTION_TEXT_CHARS = 12000;
const PORTION_PAGES = 2;

type Step = "analyze" | "facts" | "report" | "done";

const PROGRESS: Record<string, number> = {
  queued: 5,
  analyze: 20,
  facts: 55,
  report: 80,
  done: 100,
};



const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const extractDocData = (content: string): any | null => {
  const cleaned = content.replace(/<ANAFYPRO_TRUNCATED\/>/g, "");
  const open = cleaned.indexOf(DOC_DATA_OPEN);
  if (open === -1) return null;
  const close = cleaned.indexOf(DOC_DATA_CLOSE, open);
  if (close === -1) return null;
  const raw = cleaned
    .slice(open + DOC_DATA_OPEN.length, close)
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.documentMode !== true) return null;
    return parsed;
  } catch {
    return null;
  }
};

// ── Ingestion d'un document : détection de troncature et découpage ──────────

/** Vrai si la réponse a manifestement été coupée (limite de jetons atteinte). */
const looksTruncated = (text: string, complete: boolean): boolean => {
  if (!complete) return true;
  if (text.includes(TRUNCATED_MARK)) return true;
  const hasSheet = text.includes(DOC_DATA_OPEN) && text.includes(DOC_DATA_CLOSE);
  const hasFacts = text.includes(FACTS_OPEN) && text.includes(FACTS_CLOSE);
  return !hasSheet || !hasFacts;
};

/**
 * Subdivise une pièce en portions maîtrisées : pages pour un PDF rendu en
 * images, sinon sections bornées de sa couche texte. Une image seule n'est pas
 * subdivisible : la liste renvoyée est alors vide.
 */
const splitAttachment = (att: any): any[] => {
  const pages: string[] = Array.isArray(att?.pageImages) ? att.pageImages : [];
  if (pages.length > 1) {
    const out: any[] = [];
    for (let i = 0; i < pages.length; i += PORTION_PAGES) {
      const slice = pages.slice(i, i + PORTION_PAGES);
      out.push({
        ...att,
        text: null,
        pageImages: slice,
        name: `${att?.name ?? "document"} (pages ${i + 1}-${i + slice.length})`,
      });
    }
    return out;
  }

  const text = typeof att?.text === "string" ? att.text : "";
  if (text.trim().length > PORTION_TEXT_CHARS) {
    const out: any[] = [];
    for (let i = 0; i < text.length; i += PORTION_TEXT_CHARS) {
      const part = text.slice(i, i + PORTION_TEXT_CHARS);
      out.push({
        ...att,
        pageImages: null,
        text: part,
        name: `${att?.name ?? "document"} (portion ${out.length + 1})`,
      });
    }
    return out;
  }

  return [];
};



// Consomme un flux SSE de ai-assistant et renvoie le texte complet.
// `complete` vaut false si le marqueur [DONE] n'a jamais été reçu : le résultat
// est alors considéré incomplet et n'est jamais enregistré comme terminé.
const callAi = async (
  token: string,
  body: Record<string, unknown>,
): Promise<{ text: string; complete: boolean; httpError?: number }> => {
  const resp = await fetch(AI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok || !resp.body) {
    return { text: "", complete: false, httpError: resp.status };
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let out = "";
  let complete = false;

  read: while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n")) !== -1) {
      let line = buf.slice(0, idx);
      buf = buf.slice(idx + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line.startsWith(":") || line.trim() === "") continue;
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6).trim();
      if (payload === "[DONE]") {
        complete = true;
        break read;
      }
      try {
        const parsed = JSON.parse(payload);
        const c = parsed.choices?.[0]?.delta?.content;
        if (c) out += c;
      } catch {
        buf = line + "\n" + buf;
        break;
      }
    }
  }

  return { text: out, complete };
};

const patchJob = async (id: string, patch: Record<string, unknown>) => {
  const { error } = await admin
    .from("btp_analysis_jobs")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) console.error("[btp-worker] patch failed", error.message);
};

// Relance une exécution serveur pour poursuivre le même travail.
const chain = (jobId: string, token: string) => {
  const p = fetch(SELF_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "x-internal-resume": "1",
    },
    body: JSON.stringify({ action: "resume", jobId, token }),
  }).catch((e) => console.error("[btp-worker] chain failed", e));
  // @ts-ignore EdgeRuntime global
  if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(p);
};

// ── Moteur : exécute les étapes restantes, en enregistrant chaque résultat ──
const process = async (jobId: string, token: string) => {
  const startedAt = Date.now();

  const load = async () => {
    const { data } = await admin
      .from("btp_analysis_jobs")
      .select("*")
      .eq("id", jobId)
      .maybeSingle();
    return data as any | null;
  };

  let job = await load();
  if (!job) return;
  if (job.status === "completed" || job.status === "failed") return;

  const attachments = Array.isArray(job.payload?.attachments)
    ? job.payload.attachments
    : [];
  const originalsAvailable = attachments.length > 0;
  const userText: string | null = job.user_text || null;
  const language = job.language === "ar" ? "ar" : "fr";
  const userProfile = job.payload?.userProfile ?? null;
  const userName = job.payload?.userName ?? null;

  const results = { ...(job.step_results || {}) } as Record<string, any>;

  const saveStep = async (step: Step, patch: Record<string, unknown>) => {
    await patchJob(jobId, {
      status: "processing",
      current_step: step,
      progress: PROGRESS[step] ?? job.progress,
      step_results: results,
      ...patch,
    });
  };

  const fail = async (message: string) => {
    const attempts = (job.attempts || 0) + 1;
    if (attempts < MAX_ATTEMPTS) {
      // Erreur potentiellement temporaire → reprise automatique limitée.
      await patchJob(jobId, {
        status: "processing",
        attempts,
        error_message: message,
        step_results: results,
      });
      chain(jobId, token);
      return;
    }
    await patchJob(jobId, {
      status: "failed",
      attempts,
      error_message: message,
      step_results: results,
    });
  };

  const budgetExceeded = () => Date.now() - startedAt > TIME_BUDGET_MS;

  try {
    await patchJob(jobId, { status: "processing" });

    // ══ Pièces jointes : pipeline STRICTEMENT par document ═════════════════
    // Un seul appel IA par document (ou par portion) : fiche compacte + faits
    // structurés dans la même réponse. Aucun appel global d'extraction.
    if (originalsAvailable) {
      if (!results.docs || typeof results.docs !== "object") results.docs = {};

      /** Un appel d'ingestion sur une pièce (document entier ou portion). */
      const ingestPiece = async (piece: any) => {
        const r = await callAi(token, {
          action: "btp_document_ingest",
          attachment: piece,
          attachments: [piece],
          originalsAvailable: true,
          userQuestion: userText,
          messages: [],
          language: "fr",
        });
        if (!r.complete || !r.text.trim()) {
          return {
            sheet: null,
            contract: null,
            truncated: !r.complete,
            error: r.httpError
              ? `Lecture du document: HTTP ${r.httpError}`
              : "Lecture du document interrompue (flux incomplet)",
          };
        }
        const truncated = looksTruncated(r.text, r.complete);
        const sheet = extractDocData(r.text);
        let contract: any = null;
        let error: string | null = null;
        try {
          const parsed = parseFactsBlock(r.text);
          if (!Array.isArray(parsed) || parsed.length === 0) {
            throw new Error("bloc de faits illisible ou vide");
          }
          const validated = validateBtpFacts(parsed);
          if (validated.counts.total === 0) throw new Error("aucun fait validé");
          contract = validated;
        } catch (e) {
          error = String((e as Error)?.message || e);
        }
        return { sheet, contract, truncated, error };
      };

      for (let i = 0; i < attachments.length; i++) {
        const docId = `doc${i + 1}`;
        const existing = results.docs[docId];
        if (existing?.done) continue;

        const att = attachments[i];
        const record: any = existing ?? {
          name: att?.name ?? docId,
          sheets: [],
          entries: [],
          errors: [],
          partsDone: 0,
          subdivided: false,
          done: false,
        };
        results.docs[docId] = record;
        await saveStep("analyze", {});

        if (!record.subdivided) {
          const first = await ingestPiece(att);
          const usable = !first.truncated && (first.sheet || first.contract);
          if (usable) {
            if (first.sheet) record.sheets = [first.sheet];
            if (first.contract) {
              record.entries = [{ docId, contract: first.contract, sourceFile: record.name }];
            }
            if (first.error) record.errors = [first.error];
            record.done = true;
            results.docs[docId] = record;
            await saveStep("analyze", {});
            if (budgetExceeded()) {
              chain(jobId, token);
              return;
            }
            continue;
          }
          // Réponse tronquée ou inexploitable → subdivision du document.
          const portions = splitAttachment(att);
          if (portions.length <= 1) {
            record.sheets = first.sheet ? [first.sheet] : [];
            record.entries = first.contract
              ? [{ docId, contract: first.contract, sourceFile: record.name }]
              : [];
            record.errors = [
              first.error ||
                (first.truncated
                  ? "Réponse tronquée et document non subdivisible"
                  : "Document non exploité"),
            ];
            record.done = true;
            results.docs[docId] = record;
            await saveStep("analyze", {});
            if (budgetExceeded()) {
              chain(jobId, token);
              return;
            }
            continue;
          }
          record.subdivided = true;
          record.partsCount = portions.length;
          record.sheets = [];
          record.entries = [];
          record.errors = [];
          record.partsDone = 0;
          results.docs[docId] = record;
          await saveStep("analyze", {});
        }

        // Document subdivisé : une ingestion par portion, reprise au grain fin.
        const portions = splitAttachment(att);
        for (let p = record.partsDone || 0; p < portions.length; p++) {
          const part = `p${p + 1}`;
          const pr = await ingestPiece(portions[p]);
          if (pr.sheet) record.sheets.push(pr.sheet);
          if (pr.contract) {
            record.entries.push({
              docId: `${docId}_${part}`,
              part,
              contract: pr.contract,
              sourceFile: portions[p]?.name ?? record.name,
            });
          }
          if (pr.error || (!pr.sheet && !pr.contract)) {
            record.errors.push(
              `${record.name} — ${part} : ${pr.error || "portion non exploitée"}`,
            );
          }
          record.partsDone = p + 1;
          results.docs[docId] = record;
          await saveStep("analyze", {});
          if (budgetExceeded()) {
            chain(jobId, token);
            return;
          }
        }
        record.done = true;
        results.docs[docId] = record;
        await saveStep("facts", {});
        if (budgetExceeded()) {
          chain(jobId, token);
          return;
        }
      }

      // ── Consolidation déterministe côté serveur (aucun appel IA) ─────────
      if (!results.factsContractText || !results.docData) {
        await saveStep("facts", {});
        const entries: ContractEntry[] = [];
        const sheets: any[] = [];
        const notes: string[] = [];
        for (let i = 0; i < attachments.length; i++) {
          const rec = results.docs[`doc${i + 1}`];
          if (!rec) continue;
          for (const e of rec.entries ?? []) entries.push(e as ContractEntry);
          for (const s of rec.sheets ?? []) sheets.push(s);
          for (const err of rec.errors ?? []) notes.push(err);
        }

        results.docData = {
          documentMode: true,
          documents: sheets,
          unexploited: notes,
        };

        if (entries.length > 0) {
          const consolidated = consolidateBtpContracts(entries);
          results.factsContract = consolidated;
          results.factsContractText = serializeConsolidatedContract(consolidated);
          results.factsError = notes.length > 0 ? notes.join(" | ") : null;
        } else {
          results.factsContract = null;
          results.factsContractText = null;
          results.factsError =
            notes.length > 0 ? notes.join(" | ") : "Aucun fait validé dans le dossier";
        }
        await saveStep("report", {});
        if (budgetExceeded()) {
          chain(jobId, token);
          return;
        }
      }
    } else {
      // ══ Texte libre sans pièce jointe : parcours inchangé ════════════════
      if (!results.docData && !results.freeTextDone) {
        await saveStep("analyze", {});
        const r = await callAi(token, {
          messages: [{ role: "user", content: userText || "" }],
          attachment: null,
          attachments: [],
          userQuestion: userText,
          language,
          userName,
          userProfile,
          category: null,
        });
        if (!r.complete || !r.text.trim()) {
          await fail(
            r.httpError
              ? `Analyse documentaire: HTTP ${r.httpError}`
              : "Analyse documentaire interrompue (flux incomplet)",
          );
          return;
        }
        const docData = extractDocData(r.text);
        if (!docData) {
          // Réponse non structurée : elle est conservée comme rapport final.
          await patchJob(jobId, {
            status: "completed",
            current_step: "done",
            progress: 100,
            final_report: r.text.trim(),
            step_results: { ...results, analysis: r.text },
            error_message: null,
          });
          return;
        }
        results.analysis = r.text;
        results.docData = docData;
        results.freeTextDone = true;
        await saveStep("facts", {});
        if (budgetExceeded()) {
          chain(jobId, token);
          return;
        }
      }

      if (!results.facts && !results.factsFailed) {
        await saveStep("facts", {});
        const r = await callAi(token, {
          action: "btp_factual_extraction",
          btpDocData: results.docData,
          attachments: [],
          originalsAvailable: false,
          userQuestion: userText,
          messages: [],
          language: "fr",
        });
        if (r.complete && r.text.trim()) {
          results.facts = r.text;
          try {
            const parsedFacts = parseFactsBlock(r.text);
            if (!Array.isArray(parsedFacts) || parsedFacts.length === 0) {
              throw new Error("bloc de faits illisible ou vide");
            }
            const contract = validateBtpFacts(parsedFacts);
            if (contract.counts.total === 0) throw new Error("aucun fait validé");
            results.factsContract = contract;
            results.factsContractText = serializeFactsContract(contract);
            results.factsError = null;
          } catch (e) {
            results.factsContract = null;
            results.factsContractText = null;
            results.factsError = String((e as Error)?.message || e);
          }
        } else {
          results.factsFailed = true;
          results.factsContract = null;
          results.factsContractText = null;
          results.factsError = r.httpError
            ? `Extraction factuelle: HTTP ${r.httpError}`
            : "Extraction factuelle interrompue (flux incomplet)";
        }
        await saveStep("report", {});
        if (budgetExceeded()) {
          chain(jobId, token);
          return;
        }
      }
    }


    // ── Étape 3 : rapport final (idempotent) ──────────────────────────────
    if (!job.final_report) {
      await saveStep("report", {});
      const r = await callAi(token, {
        action: "btp_deep_technical_analysis",
        btpDocData: results.docData,
        // Faits validés de l'étape 2 : le CONTRAT est la seule source de faits
        // du rapport. Aucun repli sur les faits bruts non validés.
        btpFacts: results.factsContractText || null,
        attachments,

        originalsAvailable,
        userQuestion: userText,
        messages: [],
        language,
        // Variante linguistique enregistrée dans le profil (dialecte) : le
        // rapport final doit être rédigé dans cette variante, jamais en arabe
        // littéraire par défaut.
        userProfile,
      });
      if (!r.complete || !r.text.trim()) {
        await fail(
          r.httpError
            ? `Rapport final: HTTP ${r.httpError}`
            : "Rapport final interrompu (flux incomplet)",
        );
        return;
      }
      await patchJob(jobId, {
        status: "completed",
        current_step: "done",
        progress: 100,
        final_report: r.text.trim(),
        step_results: results,
        error_message: null,
      });
      return;
    }

    await patchJob(jobId, {
      status: "completed",
      current_step: "done",
      progress: 100,
      step_results: results,
    });
  } catch (e) {
    console.error("[btp-worker] process error", e);
    await fail(String((e as Error)?.message || e));
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    // ── Reprise interne (self-chaining) ────────────────────────────────────
    if (action === "resume" && req.headers.get("x-internal-resume") === "1") {
      const auth = req.headers.get("Authorization") || "";
      if (auth !== `Bearer ${SERVICE_ROLE_KEY}`) return json({ error: "forbidden" }, 403);
      const { jobId, token } = body;
      if (!jobId || !token) return json({ error: "missing job" }, 400);
      const p = process(jobId, token);
      // @ts-ignore EdgeRuntime global
      if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(p);
      else await p;
      return json({ ok: true });
    }

    // ── Appels utilisateur : authentification obligatoire ──────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
    const token = authHeader.replace("Bearer ", "");
    const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userError,
    } = await anon.auth.getUser(token);
    if (userError || !user) return json({ error: "unauthorized" }, 401);

    // ── status : état persistant du travail (source de vérité) ─────────────
    if (action === "status") {
      const query = admin
        .from("btp_analysis_jobs")
        .select(
          "id, status, language, progress, current_step, final_report, error_message, documents, user_text, step_results, created_at, updated_at",
        )
        .eq("user_id", user.id);
      const { data } = body?.jobId
        ? await query.eq("id", body.jobId).maybeSingle()
        : await query.order("created_at", { ascending: false }).limit(1).maybeSingle();

      const row = data as any | null;
      // Travail « processing » orphelin (fonction tuée) → reprise automatique.
      if (
        row &&
        row.status === "processing" &&
        Date.now() - new Date(row.updated_at).getTime() > STALE_MS
      ) {
        chain(row.id, token);
      }
      // Les résultats intermédiaires ne sont jamais exposés : seule la synthèse
      // structurée nécessaire au transfert vers le Devis intelligent est rendue.
      let job: any = row;
      if (row) {
        const { step_results, ...rest } = row;
        job = {
          ...rest,
          docData: step_results?.docData ?? null,
          // Faits validés (contrat unique) : seule source du brouillon de devis.
          btpFacts: step_results?.factsContractText ?? null,
          btpFactsError: step_results?.factsError ?? null,
          btpFactsContract: step_results?.factsContract ?? null,
        };
      }
      return json({ job });
    }

    // ── start : création du travail persistant puis exécution serveur ──────
    if (action === "start") {
      const attachments = Array.isArray(body.attachments) ? body.attachments : [];
      const userText = typeof body.userText === "string" ? body.userText.trim() : "";
      if (!userText && attachments.length === 0) return json({ error: "empty" }, 400);

      // Anti double-lancement : un travail actif est renvoyé tel quel.
      const { data: active } = await admin
        .from("btp_analysis_jobs")
        .select("id, status, progress, current_step, final_report, error_message, updated_at")
        .eq("user_id", user.id)
        .in("status", ["queued", "processing"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (active) {
        if (Date.now() - new Date((active as any).updated_at).getTime() > STALE_MS) {
          chain((active as any).id, token);
        }
        return json({ job: active, reused: true });
      }

      const { data: created, error } = await admin
        .from("btp_analysis_jobs")
        .insert({
          user_id: user.id,
          status: "queued",
          current_step: "queued",
          progress: PROGRESS.queued,
          language: body.language === "ar" ? "ar" : "fr",
          user_text: userText || null,
          documents: attachments.map((a: any) => ({ name: a?.name, kind: a?.kind })),
          payload: {
            attachments,
            userProfile: body.userProfile ?? null,
            userName: body.userName ?? null,
          },
        })
        .select("id, status, progress, current_step, final_report, error_message")
        .single();

      if (error || !created) {
        console.error("[btp-worker] insert failed", error?.message);
        return json({ error: "insert_failed" }, 500);
      }

      const p = process((created as any).id, token);
      // @ts-ignore EdgeRuntime global
      if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(p);

      return json({ job: created, reused: false });
    }

    // ── retry : relance explicite après échec confirmé ─────────────────────
    if (action === "retry") {
      const { jobId } = body;
      if (!jobId) return json({ error: "missing job" }, 400);
      const { data: job } = await admin
        .from("btp_analysis_jobs")
        .select("id, status")
        .eq("id", jobId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!job) return json({ error: "not_found" }, 404);
      await patchJob(jobId, { status: "processing", attempts: 0, error_message: null });
      const p = process(jobId, token);
      // @ts-ignore EdgeRuntime global
      if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(p);
      return json({ ok: true });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    console.error("[btp-worker] fatal", e);
    return json({ error: "internal" }, 500);
  }
});
