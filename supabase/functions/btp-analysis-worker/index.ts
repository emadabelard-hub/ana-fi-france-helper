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

    // ── Étape 1 : analyse documentaire (idempotente) ──────────────────────
    if (!results.docData) {
      await saveStep("analyze", {});
      const displayText =
        userText ||
        (attachments.length > 0
          ? `📎 ${attachments.map((a: any) => a.name).join(", ")}`
          : "");
      const r = await callAi(token, {
        messages: [{ role: "user", content: displayText }],
        attachment: attachments[0] ?? null,
        attachments,
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
      await saveStep("facts", {});
      if (budgetExceeded()) {
        chain(jobId, token);
        return;
      }
    }

    // ── Étape 2 : extraction factuelle (idempotente) ──────────────────────
    if (!results.facts) {
      await saveStep("facts", {});
      const r = await callAi(token, {
        action: "btp_factual_extraction",
        btpDocData: results.docData,
        attachments,
        originalsAvailable,
        userQuestion: userText,
        messages: [],
        language: "fr",
      });
      if (r.complete && r.text.trim()) {
        results.facts = r.text;
      } else {
        // L'extraction factuelle est un contrôle interne : son échec ne doit
        // pas empêcher la production du rapport final.
        results.facts = "";
        results.factsFailed = true;
      }
      await saveStep("report", {});
      if (budgetExceeded()) {
        chain(jobId, token);
        return;
      }
    }

    // ── Étape 3 : rapport final (idempotent) ──────────────────────────────
    if (!job.final_report) {
      await saveStep("report", {});
      const r = await callAi(token, {
        action: "btp_deep_technical_analysis",
        btpDocData: results.docData,
        attachments,
        originalsAvailable,
        userQuestion: userText,
        messages: [],
        language,
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
        job = { ...rest, docData: step_results?.docData ?? null };
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
