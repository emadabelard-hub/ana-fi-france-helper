import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface UserProfile {
  full_name?: string;
  address?: string;
  phone?: string;
  caf_number?: string;
  foreigner_number?: string;
  social_security?: string;
}

interface RequestBody {
  userMessage: string;
  profile?: UserProfile;
}

// Input validation constants
const MAX_MESSAGE_LENGTH = 5000;
const MAX_FIELD_LENGTH = 500;
const ALLOWED_PROFILE_FIELDS = ['full_name', 'address', 'phone', 'caf_number', 'foreigner_number', 'social_security'];

function validateInput(body: unknown): { valid: true; data: RequestBody } | { valid: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Corps de requête invalide' };
  }

  const { userMessage, profile } = body as RequestBody;

  // Validate userMessage
  if (!userMessage || typeof userMessage !== 'string') {
    return { valid: false, error: 'Message utilisateur requis' };
  }

  if (userMessage.trim().length === 0) {
    return { valid: false, error: 'Message utilisateur ne peut pas être vide' };
  }

  if (userMessage.length > MAX_MESSAGE_LENGTH) {
    return { valid: false, error: `Message trop long (max ${MAX_MESSAGE_LENGTH} caractères)` };
  }

  // Validate profile if provided
  if (profile !== undefined && profile !== null) {
    if (typeof profile !== 'object') {
      return { valid: false, error: 'Données de profil invalides' };
    }

    for (const [key, value] of Object.entries(profile)) {
      if (!ALLOWED_PROFILE_FIELDS.includes(key)) {
        return { valid: false, error: `Champ de profil non autorisé: ${key}` };
      }

      if (value !== null && value !== undefined && typeof value !== 'string') {
        return { valid: false, error: `Valeur invalide pour le champ: ${key}` };
      }

      if (typeof value === 'string' && value.length > MAX_FIELD_LENGTH) {
        return { valid: false, error: `Champ ${key} trop long (max ${MAX_FIELD_LENGTH} caractères)` };
      }
    }
  }

  return { valid: true, data: { userMessage: userMessage.trim(), profile } };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const rawBody = await req.json();
    
    // Validate input
    const validation = validateInput(rawBody);
    if (!validation.valid) {
      console.log("Validation error:", validation.error);
      return new Response(JSON.stringify({ error: validation.error }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { userMessage, profile } = validation.data;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build system prompt with PII minimization - use placeholders for sensitive data
    const systemPrompt = buildSystemPrompt(profile);
    
    console.log("Processing request with message length:", userMessage.length);
    
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage }
        ],
        stream: false,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requêtes dépassée. Veuillez réessayer plus tard." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Crédits insuffisants. Veuillez recharger votre compte." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "Erreur du service IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in AI response");
    }

    // Parse the AI response into sections
    const result = parseAIResponse(content);

    // Post-process: Replace placeholders with actual user data (client-side replacement)
    const processedResult = replacePlaceholders(result, profile);

    return new Response(JSON.stringify(processedResult), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in analyze-request:", error);
    return new Response(JSON.stringify({ 
      error: "Une erreur est survenue lors du traitement de votre demande" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function buildSystemPrompt(profile: UserProfile | undefined): string {
  // PII Minimization: Only send placeholder markers to AI, not actual sensitive data
  // The AI will generate templates with these placeholders that get replaced after
  const hasProfile = profile && (profile.full_name || profile.address);
  
  const headerInstructions = hasProfile ? `
Information de l'expéditeur à utiliser dans l'en-tête de la lettre (utilise ces MARQUEURS EXACTS):
- Nom complet: [NOM_COMPLET] (ou "[À compléter]" si non fourni)
- Adresse: [ADRESSE] (ou "[À compléter]" si non fourni)
- Téléphone: [TELEPHONE] (ou "[À compléter]" si non fourni)
- Numéro CAF: [NUMERO_CAF] (inclure seulement si pertinent pour la demande)
- Numéro étranger: [NUMERO_ETRANGER] (inclure seulement si pertinent pour la demande)
- Numéro de Sécurité Sociale: [NUMERO_SS] (inclure seulement si pertinent pour la demande)

IMPORTANT: Utilise ces marqueurs entre crochets EXACTEMENT comme indiqué. Ils seront remplacés par les vraies données.
` : '';

  return `Tu es un assistant administratif expert spécialisé dans l'aide aux résidents étrangers en France. Tu maîtrises parfaitement le droit administratif français, notamment:
- Le CESEDA (Code de l'entrée et du séjour des étrangers et du droit d'asile)
- Le Code de la Sécurité Sociale
- Le Code de l'action sociale et des familles
- Les procédures de la CAF, Préfecture, et autres administrations françaises

${headerInstructions}

Tu dois générer TROIS sections distinctes dans ta réponse, TOUJOURS dans ce format exact:

===LETTRE===
[Rédige ici une lettre administrative formelle en français parfait. La lettre doit:
- Avoir un en-tête professionnel avec les coordonnées de l'expéditeur (utilise les marqueurs fournis)
- Être adressée à l'organisme approprié (Préfecture, CAF, etc.)
- Contenir un objet clair
- Citer les articles de loi pertinents (CESEDA, CSS, etc.)
- Être signée professionnellement
- Avoir la date du jour]

===NOTE_JURIDIQUE===
[Rédige une note technique en français expliquant brièvement:
- Les textes de loi applicables
- Les délais légaux
- Les droits du demandeur
- Les recours possibles]

===PLAN_ACTION===
[Rédige en arabe un plan d'action clair et simple pour l'utilisateur:
- Explique ce que dit la lettre
- Liste les étapes à suivre
- Indique les documents nécessaires
- Donne des conseils pratiques]

IMPORTANT: 
- Comprends parfaitement l'arabe si l'utilisateur écrit en arabe
- Sois précis dans les citations légales
- La lettre doit être immédiatement utilisable
- Le plan en arabe doit être compréhensible et rassurant`;
}

function parseAIResponse(content: string): { 
  formalLetter: string; 
  legalNote: string; 
  actionPlan: string 
} {
  const letterMatch = content.match(/===LETTRE===([\s\S]*?)(?====NOTE_JURIDIQUE===|$)/);
  const legalMatch = content.match(/===NOTE_JURIDIQUE===([\s\S]*?)(?====PLAN_ACTION===|$)/);
  const actionMatch = content.match(/===PLAN_ACTION===([\s\S]*?)$/);

  return {
    formalLetter: letterMatch ? letterMatch[1].trim() : content,
    legalNote: legalMatch ? legalMatch[1].trim() : "Note juridique non disponible",
    actionPlan: actionMatch ? actionMatch[1].trim() : "خطة العمل غير متوفرة"
  };
}

function replacePlaceholders(result: { formalLetter: string; legalNote: string; actionPlan: string }, profile: UserProfile | undefined): { formalLetter: string; legalNote: string; actionPlan: string } {
  if (!profile) {
    return result;
  }

  // Replace placeholders with actual user data
  const replacements: Record<string, string> = {
    '[NOM_COMPLET]': profile.full_name || '[À compléter]',
    '[ADRESSE]': profile.address || '[À compléter]',
    '[TELEPHONE]': profile.phone || '[À compléter]',
    '[NUMERO_CAF]': profile.caf_number || '[À compléter]',
    '[NUMERO_ETRANGER]': profile.foreigner_number || '[À compléter]',
    '[NUMERO_SS]': profile.social_security || '[À compléter]',
  };

  let processedLetter = result.formalLetter;
  for (const [placeholder, value] of Object.entries(replacements)) {
    processedLetter = processedLetter.split(placeholder).join(value);
  }

  return {
    ...result,
    formalLetter: processedLetter
  };
}
