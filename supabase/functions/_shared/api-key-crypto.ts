// AES-GCM encryption helpers for user-provided API keys.
// Uses USER_API_KEY_ENCRYPTION_SECRET (server-only) as the key material,
// hashed to 256 bits with SHA-256. Ciphertext format: base64(iv || ciphertext).

const SECRET = Deno.env.get("USER_API_KEY_ENCRYPTION_SECRET");

async function getKey(): Promise<CryptoKey> {
  if (!SECRET) throw new Error("USER_API_KEY_ENCRYPTION_SECRET is not configured");
  const raw = new TextEncoder().encode(SECRET);
  const hash = await crypto.subtle.digest("SHA-256", raw);
  return crypto.subtle.importKey("raw", hash, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

function toB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function fromB64(s: string): Uint8Array {
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

const ENVELOPE_PREFIX = "enc:v1:";

export async function encryptApiKey(plaintext: string): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder().encode(plaintext);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc));
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv, 0);
  out.set(ct, iv.length);
  return ENVELOPE_PREFIX + toB64(out);
}

export async function decryptApiKey(stored: string): Promise<string> {
  // Backward-compat: legacy plaintext rows have no prefix; return as-is
  // so users can still consume until they save again (which re-encrypts).
  if (!stored.startsWith(ENVELOPE_PREFIX)) return stored;
  const key = await getKey();
  const buf = fromB64(stored.slice(ENVELOPE_PREFIX.length));
  const iv = buf.slice(0, 12);
  const ct = buf.slice(12);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return new TextDecoder().decode(pt);
}
