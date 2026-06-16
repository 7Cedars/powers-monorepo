import type { ResolvedSkill } from '../../agent/AgentSession.js';
import { fetchUrl } from './handlers/fetchUrl.js';
import { coingeckoPrice } from './handlers/coingeckoPrice.js';
import { snapshotProposal } from './handlers/snapshotProposal.js';
import { githubFile } from './handlers/githubFile.js';
import { chainlinkPrice } from './handlers/chainlinkPrice.js';
import { assessProposal } from './handlers/assessProposal.js';

export async function dispatchSkill(
  skill: ResolvedSkill,
  input: Record<string, unknown>
): Promise<string> {
  const { handler, handlerConfig } = skill.definition;
  const allowedDomains = (handlerConfig.allowedDomains as string[]) ?? [];

  switch (handler) {
    case 'fetch_url': {
      const url = String(input.url ?? '');
      return fetchUrl(url, allowedDomains);
    }

    case 'coingecko_price': {
      const ids = Array.isArray(input.coinIds) ? input.coinIds as string[] : [String(input.coinId ?? 'bitcoin')];
      const vs = Array.isArray(input.vsCurrencies) ? input.vsCurrencies as string[] : ['usd'];
      return coingeckoPrice(ids, vs, ['api.coingecko.com', ...allowedDomains]);
    }

    case 'snapshot_proposal': {
      const id = String(input.proposalId ?? '');
      return snapshotProposal(id, ['hub.snapshot.org', ...allowedDomains]);
    }

    case 'github_file': {
      const owner = String(input.owner ?? handlerConfig.owner ?? '');
      const repo = String(input.repo ?? handlerConfig.repo ?? '');
      const filePath = String(input.filePath ?? input.path ?? '');
      const ref = String(input.ref ?? handlerConfig.ref ?? 'main');
      return githubFile(owner, repo, filePath, ref, ['raw.githubusercontent.com', ...allowedDomains]);
    }

    case 'chainlink_price': {
      const feedAddress = String(input.feedAddress ?? handlerConfig.feedAddress ?? '') as `0x${string}`;
      const chainId = Number(input.chainId ?? handlerConfig.chainId ?? 11155111);
      return chainlinkPrice(feedAddress, chainId);
    }

    case 'assess_proposal': {
      const proposalUrl = String(input.proposal_url ?? '');
      const proposalDescription = input.proposal_description
        ? String(input.proposal_description)
        : undefined;
      const criteria = String(handlerConfig.criteria ?? '');
      return assessProposal(proposalUrl, criteria, allowedDomains, proposalDescription);
    }

    default:
      return `Unknown skill handler: ${handler}`;
  }
}
