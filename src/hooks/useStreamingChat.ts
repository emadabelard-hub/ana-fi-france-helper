/**
 * Custom hook for streaming chat responses from the Pro Admin Assistant
 * Handles SSE parsing and token-by-token rendering
 */

type StreamCallbacks = {
  onDelta: (deltaText: string) => void;
  onDone: () => void;
  onError: (error: { status?: number; message: string }) => void;
};

type StreamParams = {
  userMessage: string;
  imageData?: string;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  language: 'fr' | 'ar';
  profile?: {
    full_name?: string;
    address?: string;
    phone?: string;
  } | null;
};

const STREAM_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pro-admin-assistant`;

function getFallbackErrorMessage(status: number | undefined, language: 'fr' | 'ar'): string {
  if (language === 'fr') {
    if (status === 429) return "Service surchargé — réessayez dans une minute.";
    if (status === 402) return "Crédits IA indisponibles — vérifiez votre abonnement/crédits.";
    if (status === 404) return "Service momentanément indisponible.";
    if (status && status >= 500) return "Problème serveur — réessayez dans un instant.";
    return "Erreur inattendue — réessayez.";
  }

  // ar
  if (status === 429) return 'الخدمة مشغولة، جرب تاني بعد دقيقة 🙏';
  if (status === 402) return 'الخدمة متوقفة مؤقتاً - جاري الإصلاح ⏳';
  if (status === 404) return 'الخدمة غير متاحة حالياً 🔧';
  if (status && status >= 500) return 'مشكلة في السيرفر، جرب تاني 🔄';
  return 'حدث خطأ غير متوقع';
}

export async function streamProAdminAssistant(
  params: StreamParams,
  callbacks: StreamCallbacks
): Promise<void> {
  const { onDelta, onDone, onError } = callbacks;

  try {
    // Get the user's session token for authenticated requests
    const { supabase } = await import('@/integrations/supabase/client');
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    const resp = await fetch(STREAM_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(params),
    });

    // Handle HTTP errors
    if (!resp.ok) {
      const status = resp.status;

      // Prefer a controlled, localized message for known statuses (avoid surfacing raw "500 ...")
      let errorMessage = getFallbackErrorMessage(status, params.language);

      // Always try to extract server-provided error details for logging
      try {
        const errorData = await resp.json();
        console.error(`pro-admin-assistant error [${status}]:`, errorData);
        if (typeof errorData?.error === 'string' && errorData.error.trim()) {
          errorMessage = errorData.error;
        }
      } catch {
        console.error(`pro-admin-assistant error [${status}]: could not parse response body`);
      }

      onError({ status, message: errorMessage });
      return;
    }

    if (!resp.body) {
      onError({ message: getFallbackErrorMessage(undefined, params.language) });
      return;
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = "";
    let streamDone = false;

    while (!streamDone) {
      const { done, value } = await reader.read();
      if (done) break;

      textBuffer += decoder.decode(value, { stream: true });

      // Process line-by-line as data arrives
      let newlineIndex: number;
      while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
        let line = textBuffer.slice(0, newlineIndex);
        textBuffer = textBuffer.slice(newlineIndex + 1);

        // Handle CRLF
        if (line.endsWith("\r")) line = line.slice(0, -1);

        // Skip SSE comments/keepalive
        if (line.startsWith(":") || line.trim() === "") continue;
        if (!line.startsWith("data: ")) continue;

        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") {
          streamDone = true;
          break;
        }

        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) {
            onDelta(content); // Emit token(s) immediately
          }
        } catch {
          // Incomplete JSON split across chunks: put it back and wait for more data
          textBuffer = line + "\n" + textBuffer;
          break;
        }
      }
    }

    // Final flush in case remaining buffered lines arrived without trailing newline
    if (textBuffer.trim()) {
      for (let raw of textBuffer.split("\n")) {
        if (!raw) continue;
        if (raw.endsWith("\r")) raw = raw.slice(0, -1);
        if (raw.startsWith(":") || raw.trim() === "") continue;
        if (!raw.startsWith("data: ")) continue;

        const jsonStr = raw.slice(6).trim();
        if (jsonStr === "[DONE]") continue;

        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) onDelta(content);
        } catch {
          // Ignore partial leftovers
        }
      }
    }

    onDone();
  } catch (error) {
    console.error("Stream error:", error);
    onError({
      message: getFallbackErrorMessage(undefined, params.language),
    });
  }
}
