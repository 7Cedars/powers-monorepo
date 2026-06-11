import { fetchUrl } from './fetchUrl.js';

export async function assessProposal(
  proposalUrl: string,
  criteria: string,
  allowedDomains: string[]
): Promise<string> {
  if (!proposalUrl) return 'Error: proposal_url is required.';

  const content = await fetchUrl(proposalUrl, allowedDomains);

  if (content.startsWith('Error:') || content.startsWith('Request to')) {
    return content;
  }

  const criteriaBlock = criteria
    ? `ASSESSMENT CRITERIA:\n${criteria}\n\n${'─'.repeat(60)}\n\n`
    : '';

  return `${criteriaBlock}PROPOSAL CONTENT:\n${content}`;
}
