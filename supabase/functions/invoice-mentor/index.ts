import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface RequestBody {
  message: string;
  conversationHistory?: Message[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { message, conversationHistory = [] }: RequestBody = await req.json();
    
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Message requis' }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `Tu es un mentor professionnel pour les artisans et auto-entrepreneurs en France. Tu aides à créer des factures et des devis professionnels.

CAPACITÉS:
- Tu comprends parfaitement l'arabe égyptien et le français
- Tu traduis les termes techniques de l'arabe vers le français professionnel
- Tu connais les obligations légales des factures en France (mentions obligatoires, TVA, etc.)

PROCESSUS DE CRÉATION DE FACTURE/DEVIS:
1. Demande d'abord: Nom du client, type de service, montant
2. Si l'utilisateur écrit en arabe, traduis le service en français technique
3. Propose un modèle de facture ou devis formaté

FORMAT DE FACTURE À UTILISER:
📄 FACTURE / DEVIS
━━━━━━━━━━━━━━━━━━━━━
📅 Date: [Date du jour]
📌 Numéro: [À compléter]

👤 DE:
[Nom de l'artisan]
[SIRET: À compléter]
[Adresse]

👤 POUR:
[Nom du client]
[Adresse client]

━━━━━━━━━━━━━━━━━━━━━
PRESTATIONS:
━━━━━━━━━━━━━━━━━━━━━
[Description du service en français]
Montant: [X] €

━━━━━━━━━━━━━━━━━━━━━
TOTAL HT: [X] €
TVA (si applicable): [X] €
TOTAL TTC: [X] €
━━━━━━━━━━━━━━━━━━━━━

Conditions de paiement: [À 30 jours / Comptant]

TRADUCTIONS COURANTES (Arabe → Français):
- سباكة = Plomberie
- كهرباء = Électricité  
- دهان = Peinture
- نجارة = Menuiserie
- بناء = Maçonnerie
- تركيب = Installation
- صيانة = Maintenance
- إصلاح = Réparation
- تجديد = Rénovation

STYLE:
- Réponds principalement en arabe égyptien si l'utilisateur écrit en arabe
- Sois amical et professionnel
- Guide l'utilisateur étape par étape
- Utilise des emojis pour rendre la conversation agréable`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...conversationHistory.map(m => ({ role: m.role, content: m.content })),
      { role: "user", content: message }
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages,
        stream: false,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requêtes dépassée. Réessayez plus tard." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Crédits insuffisants." }), {
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

    return new Response(JSON.stringify({ response: content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in invoice-mentor:", error);
    return new Response(JSON.stringify({ 
      error: "Une erreur est survenue" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
