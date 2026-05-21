import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

import { anthropicCompatFetch } from "../_shared/anthropic-compat.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ════════════════════════════════════════════════════════════════════════════
//  SMART DEVIS ANALYZER — Architecture simple, UN SEUL appel Claude
//  - analyze_image : 1 appel claude-sonnet-4-5 → items JSON, retour direct
//  - generate_items : passthrough (aucun traitement, items inchangés)
//  - chat : conservé tel quel (utilisé par la conversation interactive)
// ════════════════════════════════════════════════════════════════════════════

const CLAUDE_SYSTEM_PROMPT = `Tu es un expert BTP français qui comprend parfaitement l'arabe dialectal égyptien.
Tu génères des devis professionnels français.`;

function buildClaudeUserPrompt(userMessage: string): string {
  return `L'artisan demande : ${userMessage}

Génère les lignes de devis en JSON STRICT, en NUMÉROTANT chaque ligne dans designation_fr et designation_ar :
{
  "items": [
    {
      "designation_fr": "1 - texte français exact",
      "designation_ar": "١ - نص عربي",
      "quantity": nombre,
      "unit": "m²" ou "forfait" ou "u" ou "ml" ou "h",
      "unitPrice": nombre,
      "lot": "LOT — NOM_DU_LOT"
    }
  ],
  "subject": "objet du devis en français"
}

Règles ABSOLUES :
1. NUMÉROTATION OBLIGATOIRE : chaque designation_fr commence par "N - " (ex: "1 - Pose de carrelage", "2 - Peinture murs"). Idem en arabe avec chiffres arabes (١ - ، ٢ - ، ٣ -).
2. RESPECTER L'UNITÉ mentionnée par l'artisan : m², forfait, u, ml, h, etc. Ne jamais convertir.
3. RESPECTER LE PRIX mentionné par l'artisan (ex: "بـ ٢٢ يورو المتر" → unitPrice: 22). Sinon mettre 0.
4. RESPECTER LA QUANTITÉ mentionnée (ex: "٢٠٠ متر" → quantity: 200).
5. Si مصنعية فقط / الماتريال على الزبون → designation_fr commence par "N - Pose" uniquement
6. Si couleur mentionnée (أزرق=bleu, أبيض=blanc, رمادي=gris, أسود=noir, أحمر=rouge, أصفر=jaune, أخضر=vert, بيج=beige) → inclure dans designation_fr
7. Si finition mentionnée (ساتيني=satinée, مط=mate, برّاق=brillante) → inclure dans designation_fr
8. Si سقف ET حيطان mentionnés → générer 2 lignes séparées et numérotées (1 - murs, 2 - plafond)
9. Matériau spécifique (فلوتون=parquet flottant, كارلاج إيطالي=carrelage italien, بانتيرة=peinture, بلاكو=placo) → mentionner dans designation_fr
10. Ne jamais ajouter de travaux non demandés.
11. RÈGLE FORFAIT (PRIORITAIRE) : Si l'artisan mentionne "forfait" ou "فورفيه" avec un montant → générer UNE SEULE ligne. designation_fr = description complète de la prestation, unit = "forfait", quantity = 1, unitPrice = le montant mentionné. NE JAMAIS décortiquer en plusieurs lignes dans ce cas.

LOT ASSIGNMENT — chaque item DOIT avoir un champ "lot". Aucun item sans lot.

LOT — DÉMOLITION ET DÉPOSE
mots-clés : démolition, dépose, décapage, arrachage, évacuation gravats, déchets, déconstruction

LOT — MAÇONNERIE ET ÉTANCHÉITÉ
mots-clés : maçonnerie, parpaing, béton, chape, fondation, terrassement, nivellement, étanchéité, isolation, enduit façade, ravalement, crépi

LOT — CARRELAGE ET FAÏENCE
mots-clés : carrelage, faïence, grès cérame, mosaïque, joint, pose sol, pose murale

LOT — REVÊTEMENTS SOL
mots-clés : parquet, stratifié, vinyle, moquette, linoléum, revêtement sol souple

LOT — PLOMBERIE SANITAIRE
mots-clés : plomberie, sanitaire, douche, baignoire, WC, lavabo, évier, robinetterie, alimentation eau, évacuation, chauffe-eau, chaudière, radiateur, chauffage au sol hydraulique, plancher chauffant hydraulique, VMC, ventilation

LOT — ÉLECTRICITÉ
mots-clés : électrique, électricité, tableau, câblage, prise, interrupteur, domotique, éclairage, luminaire, chauffage au sol électrique, plancher chauffant électrique, VMC électrique, climatisation

LOT — PEINTURE ET ENDUITS
mots-clés : peinture, enduit, crépi intérieur, impression, lasure, vernis, ravalement intérieur, placo, cloison, faux plafond, BA13

LOT — MENUISERIE
mots-clés : fenêtre, porte, vitrage, volet, portail, store, menuiserie, huisserie, parclose

LOT — NETTOYAGE ET DIVERS
mots-clés : nettoyage, clôture, allée, terrasse extérieure, divers, aménagement extérieur

Règles de lot :
- Chaque item DOIT avoir un lot — zéro orphan autorisé
- Si un item correspond à plusieurs lots → choisir le plus spécifique
- Si aucun mot-clé ne correspond → LOT — NETTOYAGE ET DIVERS (fallback)
- Le champ "lot" doit contenir EXACTEMENT la chaîne "LOT — NOM" avec le tiret long (—)

Réponds UNIQUEMENT avec le JSON, sans texte avant ni après, sans markdown.`;
}

async function callClaude(opts: {
  apiKey: string;
  userMessage: string;
  imageBase64?: string;
  mimeType?: string;
}): Promise<{ items: any[]; subject: string }> {
  const userContent: any[] = [];
  if (opts.imageBase64) {
    userContent.push({
      type: "image",
      source: {
        type: "base64",
        media_type: opts.mimeType || "image/jpeg",
        data: opts.imageBase64,
      },
    });
  }
  userContent.push({
    type: "text",
    text: buildClaudeUserPrompt(opts.userMessage || "Analyse la photo et propose un devis BTP standard."),
  });

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": opts.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 4000,
      system: CLAUDE_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    console.error("[claude] HTTP error:", resp.status, errText);
    throw new Error(`Claude API error ${resp.status}`);
  }

  const data = await resp.json();
  const rawText: string = data?.content?.[0]?.text || "";
  console.log("[claude] rawText:", rawText);

  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error("[claude] no JSON found in response");
    return { items: [], subject: "" };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    const items = Array.isArray(parsed.items) ? parsed.items : [];
    const subject = typeof parsed.subject === "string" ? parsed.subject : "";
    return { items, subject };
  } catch (e) {
    console.error("[claude] parse error:", e);
    return { items: [], subject: "" };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
  );

  try {
    // Strict auth: require authenticated (non-anonymous) user — paid API endpoint
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: { user: _authUser }, error: _authError } = await supabaseClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (_authError || !_authUser || _authUser.is_anonymous) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, imageData, mimeType, userMessage, conversationHistory } = body;

    // ──────────────────────────────────────────────────────────────────────
    //  ACTION : analyze_image — UN SEUL appel Claude
    // ──────────────────────────────────────────────────────────────────────
    if (action === "analyze_image") {
      const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
      if (!anthropicKey) {
        return new Response(
          JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Récupérer la première image si fournie (frontend compresse côté client)
      let img: string | undefined;
      let imgMime: string | undefined;
      if (typeof imageData === "string" && imageData.length > 0) {
        img = imageData.replace(/^data:[^;]+;base64,/, "");
        imgMime = mimeType || "image/jpeg";
      } else if (Array.isArray(body.files)) {
        const firstImg = body.files.find((f: any) => f?.type === "image" && f?.data);
        if (firstImg) {
          img = String(firstImg.data).replace(/^data:[^;]+;base64,/, "");
          imgMime = firstImg.mimeType || "image/jpeg";
        }
      }

      const text = typeof userMessage === "string" ? userMessage.trim() : "";
      if (!text && !img) {
        return new Response(
          JSON.stringify({ items: [], suggestedItems: [], devis_subject_fr: "" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { items, subject } = await callClaude({
        apiKey: anthropicKey,
        userMessage: text,
        imageBase64: img,
        mimeType: imgMime,
      });

      console.log("[analyze_image] items:", items.length, "subject:", subject);

      return new Response(
        JSON.stringify({
          items,
          suggestedItems: items, // alias pour compat frontend
          devis_subject_fr: subject,
          subject,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ──────────────────────────────────────────────────────────────────────
    //  ACTION : generate_items — passthrough (aucun traitement)
    // ──────────────────────────────────────────────────────────────────────
    if (action === "generate_items") {
      const { analysisData } = body;
      const items = Array.isArray(analysisData?.suggestedItems)
        ? analysisData.suggestedItems
        : Array.isArray(analysisData?.items)
        ? analysisData.items
        : [];

      return new Response(
        JSON.stringify({ items, summary: {}, verification: {} }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ──────────────────────────────────────────────────────────────────────
    //  ACTION : chat — conversation interactive (conservé)
    // ──────────────────────────────────────────────────────────────────────
    if (action === "chat") {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) throw new Error("AI service not configured");

      const systemPrompt = `أنت شبيك لبيك — EXPERT BTP terrain، chef de chantier + artisan confirmé في فرنسا.

دورك: تحلل الشانتي وتقول للمعلم بالظبط إيه اللي لازم يتعمل، بالترتيب الصح، بمنطق شانتي حقيقي.

اللغة: عامية مصرية فقط مع مصطلحات فرنسية تقنية.
⛔ ممنوع: دارجة مغربية أو عربي فصحى. مصري بس.

VOCABULAIRE (translittération):
Peinture=بنتيرة, Enduit=معجون, Carrelage=كارلاج, Ponçage=صنفرة, Primaire=سوسكوش,
Décapage=ديكاباج, Démontage=ديمونتاج, Ragréage=راغرياج, Protection=بروتيكسيون.

⚠️ Ne propose QUE les travaux explicitement mentionnés. N'invente jamais évacuation gravats, protection, primaire, etc. sauf si demandé.

Format de réponse :
👷 **تحليل سريع**
**الحالة:** ...
**الشغل الأساسي:** ✔ ... ✔ ... ✔ ...
**المدة:** ...

📄 **Rapport chantier (français pur):**
- **État:** ...
- **Travaux:** ...
- **Risques:** ...
- **Recommandations:** ...
- **Durée:** ...

لما تخلص قول: "✅ التحليل خلص — تقدر تعمل الدوفي يدوي دلوقتي."`;

      const messages: any[] = [
        { role: "system", content: systemPrompt },
        ...(conversationHistory || []),
      ];
      if (userMessage) messages.push({ role: "user", content: userMessage });

      const response = await anthropicCompatFetch({
        method: "POST",
        headers: {
          Authorization: "Bearer " + LOVABLE_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages,
          stream: true,
        }),
      });

      if (!response.ok) {
        const status = response.status;
        if (status === 429) {
          return new Response(
            JSON.stringify({ error: "السيستم مشغول، حاول تاني" }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        if (status === 402) {
          return new Response(
            JSON.stringify({ error: "رصيد الذكاء الاصطناعي نفد" }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        throw new Error("AI error: " + status);
      }

      return new Response(response.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    return new Response(
      JSON.stringify({ error: `Unknown action: ${action}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[smart-devis-analyzer] error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
