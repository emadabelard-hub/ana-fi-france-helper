/**
 * Global Audio Controller — ensures ONLY ONE audio stream plays at a time.
 * Any new play() call instantly stops the previous one.
 */

let currentAudio: HTMLAudioElement | null = null;
let currentObjectUrl: string | null = null;

export function stopGlobalAudio() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.onended = null;
    currentAudio.onerror = null;
    currentAudio = null;
  }
  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = null;
  }
}

export function isGlobalAudioPlaying(): boolean {
  return currentAudio !== null && !currentAudio.paused;
}

/**
 * Fetch OpenAI TTS audio and play it. Stops any previous audio first.
 * Returns a promise that resolves when playback ends (or rejects on error).
 */
export async function playTTS(text: string, voice = 'nova'): Promise<void> {
  // 1. Stop anything currently playing
  stopGlobalAudio();

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) throw new Error('Missing config');

  const response = await fetch(`${supabaseUrl}/functions/v1/tts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
    },
    body: JSON.stringify({ text, voice }),
  });

  if (!response.ok) throw new Error(`TTS failed: ${response.status}`);

  const blob = await response.blob();
  if (blob.size < 100) throw new Error('Empty audio');

  const url = URL.createObjectURL(blob);
  currentObjectUrl = url;

  return new Promise<void>((resolve, reject) => {
    const audio = new Audio(url);
    currentAudio = audio;

    audio.onended = () => {
      if (currentAudio === audio) {
        currentAudio = null;
        URL.revokeObjectURL(url);
        currentObjectUrl = null;
      }
      resolve();
    };
    audio.onerror = () => {
      if (currentAudio === audio) {
        currentAudio = null;
        URL.revokeObjectURL(url);
        currentObjectUrl = null;
      }
      reject(new Error('Audio playback error'));
    };

    audio.play().catch((e) => {
      currentAudio = null;
      URL.revokeObjectURL(url);
      currentObjectUrl = null;
      reject(e);
    });
  });
}
