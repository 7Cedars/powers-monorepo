const MAX_BYTES = 50 * 1024; // 50 KB
const TIMEOUT_MS = 5_000;
const BLOCKED_RESPONSE_HEADERS = ['set-cookie', 'authorization'];

export async function fetchUrl(
  url: string,
  allowedDomains: string[]
): Promise<string> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return `Error: invalid URL "${url}"`;
  }

  const hostname = parsed.hostname.toLowerCase();
  const allowed = allowedDomains.some((d) => {
    const domain = d.toLowerCase();
    return hostname === domain || hostname.endsWith(`.${domain}`);
  });

  if (!allowed) {
    return `Request to ${hostname} blocked by allowlist. Add it in skill config to proceed.`;
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return `Error: only http/https URLs are allowed.`;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: { 'User-Agent': 'powers-ai-agent/1.0' },
    });
    clearTimeout(timer);

    const contentType = response.headers.get('content-type') ?? '';
    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    const truncated = bytes.length > MAX_BYTES ? bytes.slice(0, MAX_BYTES) : bytes;
    const text = new TextDecoder().decode(truncated);

    const status = `HTTP ${response.status}`;
    const ct = `Content-Type: ${contentType}`;
    const trunc = bytes.length > MAX_BYTES ? `\n[Truncated to 50KB]` : '';

    return `${status}\n${ct}\n\n${text}${trunc}`;
  } catch (err: any) {
    if (err?.name === 'AbortError') return `Error: request to ${url} timed out after 5s`;
    return `Error fetching ${url}: ${String(err)}`;
  }
}
