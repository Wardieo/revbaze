export async function boundedBody(request: Request, maxBytes: number) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Invalid body");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new Error("Body too large");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}
const encode = (value: Uint8Array) =>
  btoa(String.fromCharCode(...value))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
const decode = (value: string) =>
  Uint8Array.from(atob(value.replaceAll("-", "+").replaceAll("_", "/")), (c) =>
    c.charCodeAt(0),
  );
async function key(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}
export async function hashSource(source: string, secret: string) {
  const hash = await crypto.subtle.sign(
    "HMAC",
    await key(secret),
    new TextEncoder().encode(source),
  );
  return Array.from(new Uint8Array(hash), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
export type TrackingSession = {
  slug: string;
  card: string;
  visitor: string;
  source: string;
  session: string;
  expires: number;
};
export async function signSession(session: TrackingSession, secret: string) {
  const payload = encode(new TextEncoder().encode(JSON.stringify(session)));
  return `${payload}.${encode(new Uint8Array(await crypto.subtle.sign("HMAC", await key(secret), new TextEncoder().encode(payload))))}`;
}
export async function verifySession(
  token: string,
  secret: string,
): Promise<TrackingSession> {
  if (!token || token.length > 1500) throw new Error("Invalid tracking token");
  const parts = token.split(".");
  if (
    parts.length !== 2 ||
    !(await crypto.subtle.verify(
      "HMAC",
      await key(secret),
      decode(parts[1]),
      new TextEncoder().encode(parts[0]),
    ))
  )
    throw new Error("Invalid tracking token");
  const session = JSON.parse(
    new TextDecoder().decode(decode(parts[0])),
  ) as TrackingSession;
  if (
    !Number.isFinite(session.expires) ||
    session.expires <= Date.now() ||
    session.expires > Date.now() + 16 * 60_000
  )
    throw new Error("Expired tracking token");
  return session;
}
