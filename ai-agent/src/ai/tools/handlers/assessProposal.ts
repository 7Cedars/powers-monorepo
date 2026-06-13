import { fetchUrl } from './fetchUrl.js';

export async function assessProposal(
  proposalUrl: string,
  criteria: string,
  allowedDomains: string[],
  proposalDescription?: string
): Promise<string> {
  if (!proposalUrl && !proposalDescription) {
    return 'Error: proposal_url or proposal_description is required.';
  }

  const sections: string[] = [];

  if (criteria) {
    sections.push(`ASSESSMENT CRITERIA:\n${criteria}\n\n${'─'.repeat(60)}`);
  }

  if (proposalDescription) {
    sections.push(`PROPOSAL DESCRIPTION:\n${proposalDescription}`);
  }

  if (proposalUrl) {
    const content = await fetchUrl(proposalUrl, allowedDomains);
    if (content.startsWith('Error:') || content.startsWith('Request to')) {
      if (proposalDescription) {
        sections.push(`PROPOSAL URL CONTENT (fetch failed): ${content}`);
      } else {
        return content;
      }
    } else {
      sections.push(`PROPOSAL URL CONTENT:\n${content}`);
    }
  }

  return sections.join('\n\n');
}
