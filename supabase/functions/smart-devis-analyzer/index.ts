import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Arabic construction term dictionary (Moroccan/North African trade dialect)
const ARABIC_TERMS: Record<string, string> = {
  // Enduit
  'أندوي': 'Enduit', 'اندوي': 'Enduit',
  // Peinture
  'بنتيرة': 'Peinture', 'بانتيرة': 'Peinture', 'بانتور': 'Peinture', 'بونتير': 'Peinture',
  // Carrelage / Céramique
  'كارلاج': 'Carrelage', 'كارولاج': 'Carrelage', 'سيراميك': 'Céramique',
  // Faïence
  'فايونس': 'Faïence', 'فيونس': 'Faïence',
  // Placo / Cloison / Gypse
  'بلاكو': 'Placo', 'بلاكوبلاتر': 'Placoplatre', 'كلوازون': 'Cloison',
  'جبس': 'Plâtre / Gypse', 'جيبس': 'Plâtre / Gypse', 'جبسن بورد': 'Plaque de plâtre',
  // Ponçage / Soufflage
  'بونساج': 'Ponçage', 'بوندوز': 'Ponçage', 'سوبلاج': 'Soufflage',
  // Plomberie
  'بلومبري': 'Plomberie', 'سباكة': 'Plomberie', 'سباكه': 'Plomberie', 'بلومبييه': 'Plomberie',
  // Électricité
  'اليكتريسيتي': 'Électricité', 'كهرباء': 'Électricité', 'كهربا': 'Électricité', 'اليكتريك': 'Électricité',
  // Parquet
  'باركي': 'Parquet', 'باركيه': 'Parquet',
  // Démontage / Montage
  'ديمونتاج': 'Démontage', 'مونتاج': 'Montage',
  // Nettoyage
  'نيتواياج': 'Nettoyage',
  // Isolation
  'ايزولاسيون': 'Isolation', 'عزل': 'Isolation', 'عزل حراري': 'Isolation thermique', 'عزل صوتي': 'Isolation phonique',
  // Étanchéité
  'ايتانشيتي': 'Étanchéité', 'عزل مائي': 'Étanchéité',
  // Ravalement / Maçonnerie / Menuiserie
  'رافالمون': 'Ravalement', 'ماسونري': 'Maçonnerie', 'مونيزري': 'Menuiserie',
  // Sous-couche / Finition / Décapage
  'سوكوش': 'Sous-couche', 'سوس كوش': 'Sous-couche', 'فينيسيون': 'Finition', 'ديكاباج': 'Décapage',
  // Chantier
  'شانتي': 'Chantier', 'شانتييه': 'Chantier',
  // Climatisation / Chauffage
  'كليماتيزاسيون': 'Climatisation', 'تكييف': 'Climatisation', 'شوفاج': 'Chauffage', 'تدفئة': 'Chauffage',
  // Robinet / Sanitaire
  'روبيني': 'Robinetterie', 'حنفية': 'Robinetterie', 'سانيتير': 'Sanitaire',
  // Prise / Interrupteur
  'بريز': 'Prise électrique', 'انتيريبتور': 'Interrupteur',
  // Faux plafond
  'فو بلافون': 'Faux plafond', 'سقف معلق': 'Faux plafond',
  // Devis / Facture
  'دوفي': 'Devis', 'فاكتير': 'Facture',
  // Moroccan/Trade specific
  'داباج': 'Dépannage', 'فورصة': 'Forfait', 'كريبي': 'Crépi', 'راغرياج': 'Ragréage',
  'بريمير': 'Primaire', 'فورنيتير': 'Fourniture', 'بلانت': 'Plinthes',
  'ديكوراسيون': 'Décoration', 'شنتيي': 'Chantier', 'ماتيريال': 'Matériaux',
};

function translateArabicTerms(text: string): string {
  let result = text;
  for (const [ar, fr] of Object.entries(ARABIC_TERMS)) {
    result = result.replace(new RegExp(ar, 'gi'), fr);
  }
  return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    // Auth (optional): accept both authenticated and public/guest calls
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
      if (claimsError || !claimsData?.claims?.sub) {
        console.warn("Invalid auth token, continuing as public call");
      }
    }

    const body = await req.json();
    const { action, imageData, mimeType, conversationHistory, userMessage, preferences } = body;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("AI service not configured");

    // Action: analyze_image - Vision analysis of photo/blueprint/document
    if (action === "analyze_image") {
      const { files } = body;

      const systemPrompt = `Tu es un Expert BTP spécialisé dans l'analyse de chantiers et l'assistance aux professionnels du bâtiment en France.
Tu combines les rôles d'expert bâtiment, conducteur de travaux et estimateur BTP.

Les informations peuvent provenir de plusieurs sources :
• photos de chantier
• croquis réalisés par l'utilisateur
• plans techniques ou plans de chantier
• schémas ou dessins explicatifs
• texte descriptif du projet

Tu dois combiner ces sources pour comprendre le chantier comme un professionnel du BTP.

═══════════════════════════════════════
  WORKFLOW D'ANALYSE (16 ÉTAPES)
═══════════════════════════════════════

1️⃣ IDENTIFICATION DU CHANTIER
- Identifier le type: piscine, façade, mur, terrasse, toiture, maçonnerie, rénovation, etc.

2️⃣ OBSERVATIONS VISUELLES OU DOCUMENTAIRES
- Décrire UNIQUEMENT ce qui est clairement visible: peinture écaillée, surface encrassée, fissures, revêtement usé, traces d'humidité, etc.

3️⃣ ANALYSE PAR ZONES
- Piscine: fond, parois, escaliers, margelles
- Façade: partie basse, centrale, haute
- Pièce: murs, plafond, sol, ouvrants

4️⃣ DIAGNOSTIC TECHNIQUE
- Proposer un diagnostic basé sur les observations.

5️⃣ CAUSES PROBABLES
- Vieillissement, humidité, exposition UV, produits chimiques, manque d'entretien, etc.

6️⃣ NIVEAU DE RISQUE
- faible / moyen / élevé

7️⃣ PLAN DE TRAVAUX
- Plan logique étape par étape.

8️⃣ ESTIMATION DES QUANTITÉS
- m² pour surfaces, m³ pour volumes, ml pour longueurs
- Basées sur photo (+10% marge), croquis, plan ou texte.

9️⃣ DURÉE DES TRAVAUX
- Estimation approximative du chantier.

🔟 MATÉRIAUX
- Lister les matériaux nécessaires.

1️⃣1️⃣ LOGIQUE DE PRIX BTP
- Associer chaque travail avec €/m², €/m³, €/ml ou forfait.

1️⃣2️⃣ INFORMATIONS MANQUANTES
- Dimensions exactes, profondeur, type de matériau, conditions d'accès, etc.

1️⃣3️⃣ NIVEAU DE CONFIANCE
- confiance élevée / moyenne / faible

1️⃣4️⃣ VÉRIFICATION FINALE
- Les observations correspondent aux informations fournies
- Le diagnostic est logique
- Les quantités sont réalistes

1️⃣5️⃣ DISTINCTION OBLIGATOIRE
- Ce qui est VISIBLE
- Ce qui est PROBABLE
- Ce qui nécessite une VÉRIFICATION SUR PLACE

1️⃣6️⃣ DEVIS INTELLIGENT
- Travaux, unité, quantité, prix unitaire, prix total (basé sur l'analyse combinée)

═══════════════════════════════════════
  RÈGLES STRICTES (INCHANGÉES)
═══════════════════════════════════════

⛔ RÈGLE STATELESS (PRIORITÉ MAXIMALE):
- Chaque analyse est INDÉPENDANTE. Tu n'as AUCUNE mémoire des devis précédents.
- Ignore tout contexte antérieur. Analyse UNIQUEMENT le contenu actuel.
- Si le sketch/texte mentionne UNIQUEMENT "Parquet", tu génères UNIQUEMENT des lignes Parquet.

⛔ RÈGLE ZERO-HALLUCINATION (PRIORITÉ ABSOLUE):
- Tu ne dois JAMAIS inventer, deviner ou ajouter des catégories de travaux non demandées.
- Mapping 1:1 OBLIGATOIRE: chaque ligne du devis = un travail EXPLICITEMENT demandé.
- En cas de doute, NE PAS ajouter.

⛔ RÈGLE ANTI-DOUBLE FACTURATION (CRITIQUE):
- "Fourniture et pose" = 1 SEULE ligne. NE PAS séparer en "Fourniture" + "Main d'œuvre pose".
- Chaque tâche = UNE SEULE ligne.

⛔ RÈGLE CONSOLIDATION FRAIS:
- Regroupe déplacement + nettoyage + évacuation en UNE SEULE ligne: "Frais de chantier / مصاريف الشانتي" (forfait).

⛔ RÈGLE TRANSLITÉRATION (TRÈS IMPORTANT):
- Pour designation_ar, utilise la TRANSLITÉRATION PHONÉTIQUE du terme français en lettres arabes (عامية مصرية).
- EXEMPLES: Parquet→باركيه, Plinthes→بلانت, Primaire→بريمير, Ragréage→راغرياج, Sous-couche→سوكوش, Enduit→أندوي, Peinture→بنتيرة, Carrelage→كارلاج, Faïence→فايونس, Ponçage→بونساج, Démontage→ديمونتاج, Nettoyage→نيتواياج, Fourniture→فورنيتير, Chantier→شانتي, Dépannage→داباج, Décapage→ديكاباج

⛔ RÈGLE PRIX (CRITIQUE):
- NE JAMAIS inventer de prix. Les prix seront remplis depuis la base de données interne.

RÈGLES D'ANALYSE:
1. PRIORITÉ AU TEXTE: Si l'utilisateur a fourni un texte, c'est la SOURCE PRINCIPALE. Les photos servent de confirmation visuelle.
2. MULTI-FICHIER: Analyse TOUS les fichiers ensemble pour UN SEUL devis cohérent.
3. PHOTOS: Marge de sécurité +10% sur les dimensions estimées.
4. PLANS/CROQUIS: Lis les dimensions exactes indiquées.
5. DOCUMENTS/PDF: Extrais les informations textuelles exactes.

LANGUE:
- Si l'utilisateur écrit en français → répondre en français professionnel.
- Si l'utilisateur écrit en arabe → expliquer en arabe égyptien (عامية مصرية) avec les termes techniques du BTP.

Réponds en JSON avec cette structure:
{
  "analysis_ar": "وصف بالعامية المصرية باستخدام المصطلحات الحرفية",
  "analysis_fr": "Description professionnelle en français",
  "devis_subject_fr": "Objet du devis auto-généré",
  "estimatedArea": "Surface totale estimée en m²",
  "inputType": "photo|blueprint|document|sketch",
  "chantierType": "piscine|facade|mur|terrasse|toiture|maconnerie|renovation|...",
  "diagnostic": {
    "observations_fr": "Ce qui est clairement visible",
    "observations_ar": "اللي باين بوضوح",
    "causes_fr": "Causes probables",
    "causes_ar": "الأسباب المحتملة",
    "riskLevel": "faible|moyen|élevé",
    "verificationNeeded_fr": "Ce qui nécessite une vérification sur place",
    "verificationNeeded_ar": "اللي محتاج معاينة في الموقع"
  },
  "workPlan_fr": "Plan de travaux étape par étape",
  "workPlan_ar": "خطة الشغل خطوة بخطوة",
  "estimatedDuration_fr": "Durée approximative",
  "estimatedDuration_ar": "المدة التقريبية",
  "materials_fr": ["Liste des matériaux nécessaires"],
  "materials_ar": ["قايمة المواد المطلوبة"],
  "missingInfo_fr": "Informations manquantes pour améliorer l'estimation",
  "missingInfo_ar": "معلومات ناقصة عشان نحسن التقدير",
  "confidence": "élevée|moyenne|faible",
  "surfaceEstimates": [
    {
      "id": "zone_1",
      "label_fr": "Description zone",
      "label_ar": "وصف المنطقة",
      "width_m": number,
      "height_m": number,
      "area_m2": number,
      "referenceObject_fr": "Repère dimensionnel",
      "referenceObject_ar": "مرجع القياس",
      "confidence": "medium",
      "workType": "peinture|carrelage|maconnerie|..."
    }
  ],
  "suggestedItems": [
    {
      "designation_fr": "Titre professionnel en français",
      "designation_ar": "ترجمة بالعامية المصرية",
      "quantity": number,
      "unit": "m²|ml|u|h|forfait",
      "unitPrice": 0,
      "category": "materials|labor|transport|cleaning|waste",
      "linkedSurfaceId": "zone_1"
    }
  ],
  "notes_ar": "ملاحظات مهمة",
  "notes_fr": "Remarques importantes"
}`;

      const messages: any[] = [
        { role: "system", content: systemPrompt },
      ];

      // Build multi-file content array
      const hasFiles = Array.isArray(files) && files.length > 0;
      const hasLegacyImage = !hasFiles && imageData;

      if (hasFiles || hasLegacyImage) {
        const contentParts: any[] = [
          { type: "text", text: userMessage || "Analyse ces fichiers et génère un devis détaillé." }
        ];

      if (hasFiles) {
          for (const file of files) {
            if (file.type === 'image' && file.data) {
              contentParts.push({
                type: "image_url",
                image_url: { url: file.data.startsWith("data:") ? file.data : `data:${file.mimeType || 'image/jpeg'};base64,${file.data}` }
              });
            }
            // PDFs: use pre-extracted text (much faster than sending raw base64)
            if (file.type === 'pdf') {
              if (file.extractedText) {
                contentParts.push({
                  type: "text",
                  text: `\n--- Contenu du document PDF "${file.name}" ---\n${file.extractedText}\n--- Fin du document ---\n`
                });
              } else if (file.data) {
                // Legacy fallback: send as image_url
                contentParts.push({
                  type: "image_url",
                  image_url: { url: file.data.startsWith("data:") ? file.data : `data:${file.mimeType || 'application/pdf'};base64,${file.data}` }
                });
              }
            }
          }
        } else if (hasLegacyImage) {
          contentParts.push({
            type: "image_url",
            image_url: { url: imageData.startsWith("data:") ? imageData : `data:${mimeType || 'image/jpeg'};base64,${imageData}` }
          });
        }

        messages.push({ role: "user", content: contentParts });
      } else {
        messages.push({ role: "user", content: userMessage || "Analyse ce document." });
      }

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages,
        }),
      });

      if (!response.ok) {
        const status = response.status;
        if (status === 429) return new Response(JSON.stringify({ error: "عذراً، السيستم مشغول حالياً. حاول مرة تانية بعد شوية" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (status === 402) return new Response(JSON.stringify({ error: "رصيد الذكاء الاصطناعي نفد" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw new Error(`AI error: ${status}`);
      }

      const aiData = await response.json();
      const content = aiData.choices?.[0]?.message?.content || "";
      
      // Try to parse JSON from the response
      let parsed;
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { analysis: content, suggestedItems: [] };
      } catch {
        parsed = { analysis: content, suggestedItems: [] };
      }

      return new Response(JSON.stringify(parsed), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: chat - Interactive context gathering
    if (action === "chat") {
      const systemPrompt = `Tu es un assistant devis intelligent pour artisans BTP en France.
Tu dois poser des questions pour affiner le devis. Parle en ARABE ÉGYPTIEN RAFFINÉ (عامية مصرية) avec des termes techniques français translittérés.

VOCABULAIRE OBLIGATOIRE (STRICTEMENT):
- Peinture = بنتيرة (JAMAIS بانتيرة)
- Enduit = أندوي
- Carrelage = كارلاج
- Chantier = شانتي (JAMAIS شانتييه)
- Dépannage = داباج
- Devis = دوفي

Si l'utilisateur tape des termes techniques en arabe dialectal (ex: أندوي, بنتيرة, كارلاج), reconnais-les et utilise les termes français correspondants.

PREMIÈRE QUESTION OBLIGATOIRE (TOUJOURS demander EN PREMIER si pas encore répondu):
🔧 "عايز التسعير إزاي؟ مواد + مصنعية (فورنيتير + بوز)، مصنعية بس، ولا جزئي (لكل بند)؟"
(Matériaux inclus, Main d'œuvre uniquement, ou Partiel ?)

QUESTIONS SUIVANTES (si pas encore répondues):
1. Qualité des matériaux: Éco (اقتصادي), Standard (عادي), ou Luxe (فخم)?
2. Remise (%): هل في خصم؟
3. Marge bénéficiaire (%): نسبة الربح المطلوبة؟

Réponds toujours de manière concise et professionnelle.
Quand tu as toutes les infos, dis "✅ جاهز لتوليد الدوفي" et résume les paramètres.`;

      const messages: any[] = [
        { role: "system", content: systemPrompt },
        ...(conversationHistory || []),
      ];

      if (userMessage) {
        const translated = translateArabicTerms(userMessage);
        messages.push({ role: "user", content: translated });
      }

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
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
        if (status === 429) return new Response(JSON.stringify({ error: "السيستم مشغول، حاول تاني" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (status === 402) return new Response(JSON.stringify({ error: "رصيد الذكاء الاصطناعي نفد" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw new Error(`AI error: ${status}`);
      }

      return new Response(response.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // Action: generate_items - Final generation with preferences applied
    if (action === "generate_items") {
      const { analysisData, materialQuality, discountPercent, profitMarginPercent, materialScope } = body;

      const scopeRule = materialScope === 'main_oeuvre_seule'
        ? `\n⛔ RÈGLE SCOPE MATÉRIAUX (CRITIQUE): Le client fournit ses propres matériaux. Chiffre UNIQUEMENT la main d'œuvre (pose, préparation, nettoyage). Les prix ne doivent PAS inclure le coût des matériaux. Utilise "Pose de..." au lieu de "Fourniture et pose de...".`
        : `\nLe devis inclut fourniture ET pose (matériaux + main d'œuvre).`;

      const systemPrompt = `Tu es un calculateur de devis BTP expert.
À partir de l'analyse fournie, génère les lignes de devis finales.
${scopeRule}
⛔ RÈGLE STATELESS (PRIORITÉ MAXIMALE):
- Cette génération est INDÉPENDANTE. Ignore tout devis ou analyse précédent.
- Génère UNIQUEMENT à partir des données d'analyse fournies dans CE message.

⛔ RÈGLE ZERO-HALLUCINATION (PRIORITÉ ABSOLUE):
- Génère UNIQUEMENT des lignes pour les travaux EXPLICITEMENT présents dans l'analyse.
- Mapping 1:1 strict entre l'analyse et les lignes générées.
- NE JAMAIS ajouter de catégories "complémentaires", "recommandées" ou "bonus".

⛔ RÈGLE ANTI-DOUBLE FACTURATION (CRITIQUE):
- "Fourniture et pose" = 1 SEULE ligne. NE PAS séparer en "Fourniture" + "Main d'œuvre pose".
- Chaque tâche identifiée = exactement 1 ligne dans le devis. ZÉRO duplication.
- Vérifie chaque item avant de l'ajouter: est-il déjà couvert par une autre ligne?
- INTERDIT de créer deux fois la même ligne (ex: deux "Peinture plafond" ou deux "Peinture murs").

⛔ RÈGLE SURFACES PEINTURE (CRITIQUE - JAMAIS MÉLANGER):
- La surface PLAFOND = surface au sol de la pièce (longueur × largeur). JAMAIS plus.
- La surface MURS = périmètre × hauteur (calculée SÉPARÉMENT). JAMAIS additionnée au plafond.
- Pour les travaux de peinture, génère des lignes SÉPARÉES avec la BONNE surface:
  * "Peinture plafond" → quantity = surface plafond (= surface au sol)
  * "Peinture murs" → quantity = surface murs (= périmètre × hauteur)
  * "Préparation murs (enduit/ponçage)" → quantity = surface murs
  * "Préparation plafond" → quantity = surface plafond (si nécessaire)
- NE JAMAIS utiliser la même surface pour murs et plafond.
- Si l'analyse donne une surface totale sans distinction, calcule:
  * Surface plafond = surface au sol
  * Surface murs = (2 × (longueur + largeur)) × hauteur (hauteur standard = 2.5m si non précisée)

⛔ RÈGLE CONSOLIDATION FRAIS:
- Regroupe déplacement + nettoyage + évacuation en 1 SEULE ligne: "Frais de chantier / مصاريف الشانتي" (forfait).

⛔ RÈGLE TRANSLITÉRATION OBLIGATOIRE pour designation_ar:
- Utilise la translitération phonétique du français en arabe ÉGYPTIEN (عامية مصرية) du métier.
- Parquet→باركيه, Plinthes→بلانت, Primaire→بريمير, Ragréage→راغرياج, Sous-couche→سوكوش, Enduit→أندوي, Peinture→بنتيرة, Carrelage→كارلاج, Faïence→فايونس, Ponçage→بونساج, Démontage→ديمونتاج, Nettoyage→نيتواياج, Fourniture→فورنيتير, Dépannage→داباج, Chantier→شانتي

⛔ RÈGLE PRIX (CRITIQUE):
- NE JAMAIS inventer de prix. Mets unitPrice = 0 pour TOUTES les lignes.
- Les prix seront remplis automatiquement depuis la base de données interne.
- Tu dois UNIQUEMENT détecter les travaux, les quantités et les unités.

RÈGLE CRITIQUE - BILINGUISME OBLIGATOIRE:
- Chaque item DOIT avoir designation_fr ET designation_ar. JAMAIS laisser vide.
- designation_fr = titre professionnel en français du BTP (ex: "Fourniture et pose de parquet stratifié")
- designation_ar = TRANSLITÉRATION phonétique en عامية مصرية (ex: "فورنيتير و بوز باركيه ستراتيفيي")

⛔ RÈGLE CODE CATALOGUE (STRICT LOCK):
- UNE TÂCHE = UNE LIGNE = UN CODE.
- Si tu reconnais le type de travail, ajoute le champ "code" exact:
  MC001=dalle béton, MC002=pose parpaing, MC003=démolition mur, MC004=ouverture mur porteur,
  CR001=pose carrelage sol,
  PB001=installation WC,
  PEI01=préparation murs, PEI02=peinture murs, PEI03=préparation plafond, PEI04=peinture plafond,
  ELE01=prise, ELE02=interrupteur, ELE03=tableau électrique,
  TOI01=tuiles, TOI02=réparation toiture,
  CHA01=protection chantier, CHA02=nettoyage chantier, CHA03=transport, CHA04=évacuation gravats.
- INTERDIT de scinder un travail en sous-lignes (préparation/raccord/test séparés) si un code unique existe.
- Si aucun code ne correspond, ne mets pas de champ "code".

Réponds UNIQUEMENT en JSON:
{
  "items": [
    {
      "designation_fr": "Titre professionnel en français",
      "designation_ar": "ترجمة بالعامية المصرية",
      "quantity": number,
      "unit": "m²|ml|u|h|forfait",
      "unitPrice": 0,
      "code": "PNT001 (optionnel, si reconnu)"
    }
  ],
  "summary": {}
}`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Données d'analyse:\n${JSON.stringify(analysisData)}\n\nGénère le devis final.` }
          ],
        }),
      });

      if (!response.ok) {
        const status = response.status;
        if (status === 429) return new Response(JSON.stringify({ error: "السيستم مشغول" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (status === 402) return new Response(JSON.stringify({ error: "الرصيد نفد" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw new Error(`AI error: ${status}`);
      }

      const aiData = await response.json();
      const content = aiData.choices?.[0]?.message?.content || "";
      
      let parsed;
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { items: [], summary: {} };
      } catch {
        parsed = { items: [], summary: {} };
      }

      return new Response(JSON.stringify(parsed), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("smart-devis-analyzer error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
