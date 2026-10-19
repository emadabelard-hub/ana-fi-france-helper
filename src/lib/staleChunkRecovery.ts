const RELOAD_KEY = "__stale_chunk_recovery";

export function isStaleChunkError(value: unknown): boolean {
  const message = value instanceof Error ? value.message : String(value ?? "");
  return /failed to fetch dynamically imported module|importing a module script failed|chunkloaderror|loading chunk/i.test(message);
}

/** One refresh per failed chunk per tab; never loop when the network stays unavailable. */
export function recoverStaleChunk(
  error: unknown,
  storage: Pick<Storage, "getItem" | "setItem"> = sessionStorage,
  reload: () => void = () => window.location.reload(),
): boolean {
  if (!isStaleChunkError(error)) return false;
  const signature = error instanceof Error ? error.message : String(error);
  try {
    if (storage.getItem(RELOAD_KEY) === signature) return false;
    storage.setItem(RELOAD_KEY, signature);
  } catch {
    // Without persistent state a refresh could become an infinite loop.
    return false;
  }
  reload();
  return true;
}