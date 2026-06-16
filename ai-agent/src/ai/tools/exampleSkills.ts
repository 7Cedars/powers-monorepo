import type { SkillDefinition } from '../../agent/AgentSession.js';

/**
 * Fetches a governance proposal (.md) from a URL and assesses it against
 * impact-focused criteria. The agent scores each criterion and produces
 * a structured recommendation.
 *
 * Usage: pass `proposal_url` pointing to a publicly accessible Markdown file
 * (GitHub raw, HackMD, etc.) and/or a `proposal_description` inline string.
 * At least one of the two must be provided.
 *
 * Add via POST /api/session/:id/skills with this object as the body.
 */
export const assessProposalImpact: SkillDefinition = {
  name: 'assess_proposal_impact',
  description:
    'Fetch a governance proposal document (Markdown) from the given URL and/or use an inline description, then assess against impact criteria. ' +
    'Call this tool whenever you need to evaluate whether a proposal is worth supporting based on its real-world impact. ' +
    'The tool returns the proposal content together with the scoring rubric; produce a structured assessment with a ' +
    'score (1–5) and a one-sentence justification per criterion, followed by an overall recommendation ' +
    '(Approve / Approve with conditions / Reject).',
  inputSchema: {
    type: 'object',
    properties: {
      proposal_url: {
        type: 'string',
        description: 'Publicly accessible URL of the proposal Markdown file.',
      },
      proposal_description: {
        type: 'string',
        description: 'Optional inline proposal text (e.g. on-chain proposalDescription field). Used alongside or instead of proposal_url.',
      },
    },
    required: [],
  },
  handler: 'assess_proposal',
  handlerConfig: {
    allowedDomains: ['raw.githubusercontent.com', 'hackmd.io', 'gist.github.com'],
    criteria: `Score each criterion 1 (Poor) → 5 (Excellent) with a one-sentence justification.

1. Problem Clarity
   Is the problem well-defined, specific, and supported by evidence?

2. Theory of Change
   Is the causal logic from action to outcome sound and realistic?

3. Measurability
   Are success metrics concrete, trackable, and time-bound?

4. Scale & Reach
   How many people, systems, or resources are positively affected?

5. Risk & Failure Modes
   Are key risks identified, and is there a credible mitigation plan?

After scoring, give an overall recommendation: Approve / Approve with conditions / Reject, with a one-paragraph rationale.`,
  },
};

/**
 * Fetches a governance proposal (.md) from a URL and assesses it against
 * financial viability criteria. The agent scores each criterion and produces
 * a structured recommendation.
 *
 * Usage: pass `proposal_url` pointing to a publicly accessible Markdown file
 * (GitHub raw, HackMD, etc.) and/or a `proposal_description` inline string.
 * At least one of the two must be provided.
 *
 * Add via POST /api/session/:id/skills with this object as the body.
 */
export const assessProposalFinancial: SkillDefinition = {
  name: 'assess_proposal_financial',
  description:
    'Fetch a governance proposal document (Markdown) from the given URL and/or use an inline description, then assess against financial viability criteria. ' +
    'Call this tool whenever you need to evaluate whether a proposal represents a sound use of DAO treasury funds. ' +
    'The tool returns the proposal content together with the scoring rubric; produce a structured assessment with a ' +
    'score (1–5) and a one-sentence justification per criterion, followed by an overall recommendation ' +
    '(Approve / Approve with conditions / Reject).',
  inputSchema: {
    type: 'object',
    properties: {
      proposal_url: {
        type: 'string',
        description: 'Publicly accessible URL of the proposal Markdown file.',
      },
      proposal_description: {
        type: 'string',
        description: 'Optional inline proposal text (e.g. on-chain proposalDescription field). Used alongside or instead of proposal_url.',
      },
    },
    required: [],
  },
  handler: 'assess_proposal',
  handlerConfig: {
    allowedDomains: ['raw.githubusercontent.com', 'hackmd.io', 'gist.github.com'],
    criteria: `Score each criterion 1 (Poor) → 5 (Excellent) with a one-sentence justification.

1. Budget Clarity
   Are all costs itemised, justified, and proportionate to the stated scope?

2. Sustainability
   Is there a credible path to financial self-sufficiency, recurring value, or a clean exit?

3. Value for Money
   Is the expected outcome proportional to the funding requested?

4. Treasury Risk
   Does the ask represent a manageable share of available DAO reserves?

5. Accountability
   Are milestones, deliverables, and reporting commitments clearly defined and enforceable?

After scoring, give an overall recommendation: Approve / Approve with conditions / Reject, with a one-paragraph rationale.`,
  },
};
