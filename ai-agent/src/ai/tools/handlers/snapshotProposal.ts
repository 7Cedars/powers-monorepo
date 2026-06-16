import { fetchUrl } from './fetchUrl.js';

export async function snapshotProposal(
  proposalId: string,
  allowedDomains: string[] = ['hub.snapshot.org']
): Promise<string> {
  const url = `https://hub.snapshot.org/graphql`;
  const query = JSON.stringify({
    query: `{ proposal(id: "${proposalId}") { id title body state scores scores_total votes created end } }`,
  });

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5_000);

    const response = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'powers-ai-agent/1.0' },
      body: query,
    });
    clearTimeout(timer);

    const hostname = new URL(url).hostname;
    const allowed = allowedDomains.some((d) => {
      const domain = d.toLowerCase();
      return hostname === domain || hostname.endsWith(`.${domain}`);
    });
    if (!allowed) {
      return `Request to ${hostname} blocked by allowlist.`;
    }

    const data = await response.json();
    return JSON.stringify(data, null, 2);
  } catch (err: any) {
    if (err?.name === 'AbortError') return `Error: Snapshot request timed out`;
    return `Error fetching Snapshot proposal ${proposalId}: ${String(err)}`;
  }
}
