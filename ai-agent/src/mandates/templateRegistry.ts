import {
  encodeAbiParameters,
  parseAbiParameters,
  type Address,
} from 'viem';

export type CalldataShape =
  | 'empty'
  | 'structured'
  | 'forwarded'
  | 'config-defined';

export interface MandateTemplate {
  name: string;
  category: 'electoral' | 'executive' | 'reform' | 'integration';
  description: string;
  calldataShape: CalldataShape;
  encode: (params: Record<string, unknown>) => `0x${string}`;
  notes?: string;
}

// ── Electoral ────────────────────────────────────────────────────────────────

const SelfSelect: MandateTemplate = {
  name: 'SelfSelect',
  category: 'electoral',
  description: 'Caller self-assigns the role configured in this mandate. No parameters required.',
  calldataShape: 'empty',
  encode: () => '0x',
};

const Nominate: MandateTemplate = {
  name: 'Nominate',
  category: 'electoral',
  description: 'Nominate or revoke self-nomination in a Nominees contract.',
  calldataShape: 'structured',
  encode: (p) =>
    encodeAbiParameters(parseAbiParameters('bool'), [Boolean(p.shouldNominate)]),
};

const PeerSelect: MandateTemplate = {
  name: 'PeerSelect',
  category: 'electoral',
  description: 'Vote on a list of nominees. Provide one boolean per nominee in order.',
  calldataShape: 'structured',
  notes: 'Call get_governance_state first to retrieve the current nominees list and their order.',
  encode: (p) =>
    encodeAbiParameters(parseAbiParameters('bool[]'), [
      (p.selections as boolean[]),
    ]),
};

const RenounceRole: MandateTemplate = {
  name: 'RenounceRole',
  category: 'electoral',
  description: 'Caller voluntarily renounces one of their own roles.',
  calldataShape: 'structured',
  encode: (p) =>
    encodeAbiParameters(parseAbiParameters('uint256'), [BigInt(p.roleId as string)]),
};

const AssignExternalRole: MandateTemplate = {
  name: 'AssignExternalRole',
  category: 'electoral',
  description: 'Syncs an account role between this Powers contract and an external Powers contract.',
  calldataShape: 'structured',
  encode: (p) =>
    encodeAbiParameters(parseAbiParameters('address'), [p.account as Address]),
};

const RoleByRoles: MandateTemplate = {
  name: 'RoleByRoles',
  category: 'electoral',
  description: 'Assigns or revokes a role based on whether the account holds prerequisite roles.',
  calldataShape: 'structured',
  encode: (p) =>
    encodeAbiParameters(parseAbiParameters('address'), [p.account as Address]),
};

const DelegateTokenSelect: MandateTemplate = {
  name: 'DelegateTokenSelect',
  category: 'electoral',
  description: 'Selects role holders based on token delegation rankings. No parameters required.',
  calldataShape: 'empty',
  encode: () => '0x',
};

const RevokeAccountsRoleId: MandateTemplate = {
  name: 'RevokeAccountsRoleId',
  category: 'electoral',
  description: 'Revokes the configured role from all current role holders. No parameters required.',
  calldataShape: 'empty',
  encode: () => '0x',
};

const RevokeInactiveAccounts: MandateTemplate = {
  name: 'RevokeInactiveAccounts',
  category: 'electoral',
  description: 'Revokes the configured role from accounts inactive in the last N mandates checked.',
  calldataShape: 'empty',
  encode: () => '0x',
};

// ── Executive ─────────────────────────────────────────────────────────────────

const OpenAction: MandateTemplate = {
  name: 'OpenAction',
  category: 'executive',
  description: 'Unconstrained external call. Specify targets, values, and calldata.',
  calldataShape: 'structured',
  notes: 'Use with care. Most powerful mandate type — no guardrails beyond role and voting.',
  encode: (p) =>
    encodeAbiParameters(
      parseAbiParameters('address[], uint256[], bytes[]'),
      [
        p.targets as Address[],
        (p.values as string[]).map((v) => BigInt(v)),
        p.calldatas as `0x${string}`[],
      ]
    ),
};

const PresetActions: MandateTemplate = {
  name: 'PresetActions',
  category: 'executive',
  description: 'Executes a fixed set of transactions pre-configured at mandate adoption. No parameters.',
  calldataShape: 'empty',
  encode: () => '0x',
};

const PresetActions_OnOwnPowers: MandateTemplate = {
  name: 'PresetActions_OnOwnPowers',
  category: 'executive',
  description: 'Executes preset calldata against the Powers contract itself. No parameters.',
  calldataShape: 'empty',
  encode: () => '0x',
};

const StatementOfIntent: MandateTemplate = {
  name: 'StatementOfIntent',
  category: 'executive',
  description: 'Records a governance statement without executing on-chain actions.',
  calldataShape: 'config-defined',
  notes: 'Parameters defined by mandate config. Typically the first step in a multi-step flow.',
  encode: (p) => {
    const args = (p.args as string[]) ?? [];
    if (args.length === 0) return '0x';
    return encodeAbiParameters(
      args.map(() => ({ type: 'string' })),
      args
    );
  },
};

const BespokeAction_Simple: MandateTemplate = {
  name: 'BespokeAction_Simple',
  category: 'executive',
  description: 'Calls a specific function on a configured target. Parameters declared in config.',
  calldataShape: 'config-defined',
  notes: 'Read mandate config via get_governance_state to determine exact parameter types.',
  encode: (p) => (p.rawCalldata as `0x${string}`) ?? '0x',
};

const BespokeAction_Advanced: MandateTemplate = {
  name: 'BespokeAction_Advanced',
  category: 'executive',
  description: 'Like BespokeAction_Simple but allows dynamic parameters between static param sets.',
  calldataShape: 'config-defined',
  notes: 'Inspect config for static params; provide only the dynamic portion.',
  encode: (p) => (p.rawCalldata as `0x${string}`) ?? '0x',
};

const BespokeAction_OnReturnValue: MandateTemplate = {
  name: 'BespokeAction_OnReturnValue',
  category: 'executive',
  description: 'Extends a parent mandate result. Requires parent action to be Fulfilled first.',
  calldataShape: 'config-defined',
  encode: (p) => (p.rawCalldata as `0x${string}`) ?? '0x',
};

const CheckExternalActionState: MandateTemplate = {
  name: 'CheckExternalActionState',
  category: 'executive',
  description: 'Gate mandate. Checks external Powers action is Fulfilled. No side effects.',
  calldataShape: 'forwarded',
  notes: 'Nonce must match the parent action nonce.',
  encode: (p) => (p.rawCalldata as `0x${string}`) ?? '0x',
};

const ExternalAction_Simple: MandateTemplate = {
  name: 'ExternalAction_Simple',
  category: 'executive',
  description: 'Forwards calldata to a specific mandate on a pre-configured target Powers contract.',
  calldataShape: 'forwarded',
  notes: 'Inspect config for target Powers address and mandateId, then apply the target template.',
  encode: (p) => (p.rawCalldata as `0x${string}`) ?? '0x',
};

const ExternalAction_Flexible: MandateTemplate = {
  name: 'ExternalAction_Flexible',
  category: 'executive',
  description: 'Forwards calldata to a caller-specified Powers contract and mandate.',
  calldataShape: 'structured',
  encode: (p) =>
    encodeAbiParameters(
      [
        { type: 'address' },
        { type: 'uint16' },
        { type: 'bytes' },
      ] as const,
      [
        p.powersTarget as Address,
        Number(p.mandateIdTarget),
        (p.callData as `0x${string}`) ?? '0x',
      ]
    ),
};

const ExternalAction_OnReturnValue: MandateTemplate = {
  name: 'ExternalAction_OnReturnValue',
  category: 'executive',
  description: 'Forwards a parent action return value to a mandate on an external Powers contract.',
  calldataShape: 'structured',
  notes: 'Parent action must be Fulfilled first.',
  encode: (p) =>
    encodeAbiParameters(
      [{ type: 'address' }, { type: 'uint16' }] as const,
      [p.powersTarget as Address, Number(p.mandateIdTarget)]
    ),
};

// ── Reform ───────────────────────────────────────────────────────────────────

const Adopt_Mandates: MandateTemplate = {
  name: 'Adopt_Mandates',
  category: 'reform',
  description: 'Proposes adoption of one or more new mandate contracts with allowed role IDs.',
  calldataShape: 'structured',
  encode: (p) =>
    encodeAbiParameters(
      parseAbiParameters('address[], uint256[]'),
      [
        p.mandates as Address[],
        (p.roleIds as string[]).map((r) => BigInt(r)),
      ]
    ),
};

const Revoke_Mandates: MandateTemplate = {
  name: 'Revoke_Mandates',
  category: 'reform',
  description: 'Revokes one or more adopted mandates by ID.',
  calldataShape: 'structured',
  encode: (p) =>
    encodeAbiParameters(
      [{ type: 'uint16[]' }] as const,
      [(p.mandateIds as number[]).map(Number)]
    ),
};

const PauseMandates: MandateTemplate = {
  name: 'PauseMandates',
  category: 'reform',
  description: 'Pauses or restarts mandates at configured flow positions.',
  calldataShape: 'structured',
  encode: (p) =>
    encodeAbiParameters(parseAbiParameters('bool'), [Boolean(p.paused)]),
};

const MandatePackage: MandateTemplate = {
  name: 'MandatePackage',
  category: 'reform',
  description: 'Adopts a pre-defined package of mandates and self-destructs. No parameters.',
  calldataShape: 'empty',
  encode: () => '0x',
};

const MandatePackage_Static: MandateTemplate = {
  name: 'MandatePackage_Static',
  category: 'reform',
  description: 'Like MandatePackage but with fully static mandate init data. No parameters.',
  calldataShape: 'empty',
  encode: () => '0x',
};

// ── Integrations — ElectionRegistry ──────────────────────────────────────────

const ElectionRegistry_Nominate: MandateTemplate = {
  name: 'ElectionRegistry_Nominate',
  category: 'integration',
  description: 'Nominates or revokes nomination for an election by title.',
  calldataShape: 'structured',
  encode: (p) =>
    encodeAbiParameters(parseAbiParameters('string'), [p.title as string]),
};

const ElectionRegistry_CreateVoteMandate: MandateTemplate = {
  name: 'ElectionRegistry_CreateVoteMandate',
  category: 'integration',
  description: 'Opens an election by creating a time-limited voting mandate.',
  calldataShape: 'structured',
  encode: (p) =>
    encodeAbiParameters(parseAbiParameters('string'), [p.title as string]),
};

const ElectionRegistry_Vote: MandateTemplate = {
  name: 'ElectionRegistry_Vote',
  category: 'integration',
  description: 'Casts votes for nominees in an open election.',
  calldataShape: 'config-defined',
  notes: 'Call get_governance_state to retrieve current nominees before encoding.',
  encode: (p) => (p.rawCalldata as `0x${string}`) ?? '0x',
};

const ElectionRegistry_Tally: MandateTemplate = {
  name: 'ElectionRegistry_Tally',
  category: 'integration',
  description: 'Tallies votes and assigns roles to winners after election closes.',
  calldataShape: 'structured',
  notes: 'Will revert if election is still open.',
  encode: (p) =>
    encodeAbiParameters(parseAbiParameters('string'), [p.title as string]),
};

const ElectionRegistry_CleanUpVoteMandate: MandateTemplate = {
  name: 'ElectionRegistry_CleanUpVoteMandate',
  category: 'integration',
  description: 'Revokes the temporary vote mandate after election completion.',
  calldataShape: 'structured',
  encode: (p) =>
    encodeAbiParameters(parseAbiParameters('string'), [p.title as string]),
};

// ── Integrations — SlateRegistry ──────────────────────────────────────────────

const SlateRegistry_AddSlate: MandateTemplate = {
  name: 'SlateRegistry_AddSlate',
  category: 'integration',
  description: 'Proposes a named slate of actions for a running slate-based election.',
  calldataShape: 'structured',
  encode: (p) =>
    encodeAbiParameters(
      parseAbiParameters('string, string, address[], uint256[], bytes[]'),
      [
        p.electionTitle as string,
        p.slateDescription as string,
        p.targets as Address[],
        (p.values as string[]).map(BigInt),
        p.calldatas as `0x${string}`[],
      ]
    ),
};

const SlateRegistry_RemoveSlate: MandateTemplate = {
  name: 'SlateRegistry_RemoveSlate',
  category: 'integration',
  description: 'Removes a previously added slate. Provide empty arrays for targets/values/calldatas.',
  calldataShape: 'structured',
  encode: (p) =>
    encodeAbiParameters(
      parseAbiParameters('string, string, address[], uint256[], bytes[]'),
      [
        p.electionTitle as string,
        p.slateDescription as string,
        [],
        [],
        [],
      ]
    ),
};

const SlateRegistry_ExecuteResult: MandateTemplate = {
  name: 'SlateRegistry_ExecuteResult',
  category: 'integration',
  description: 'Executes the winning slate after voting closes.',
  calldataShape: 'structured',
  notes: 'Will revert if voting period is not yet closed.',
  encode: (p) =>
    encodeAbiParameters(parseAbiParameters('string'), [p.electionTitle as string]),
};

// ── Integrations — Safe ───────────────────────────────────────────────────────

const Safe_ExecTransaction: MandateTemplate = {
  name: 'Safe_ExecTransaction',
  category: 'integration',
  description: 'Executes a transaction through the Safe multisig treasury.',
  calldataShape: 'config-defined',
  notes: 'Parameters declared in config string[]. Powers acts as delegate with v=1 signature.',
  encode: (p) => (p.rawCalldata as `0x${string}`) ?? '0x',
};

const Safe_ExecTransaction_OnReturnValue: MandateTemplate = {
  name: 'Safe_ExecTransaction_OnReturnValue',
  category: 'integration',
  description: 'Safe transaction whose params include the return value of a parent action.',
  calldataShape: 'config-defined',
  encode: (p) => (p.rawCalldata as `0x${string}`) ?? '0x',
};

const Safe_RecoverTokens: MandateTemplate = {
  name: 'Safe_RecoverTokens',
  category: 'integration',
  description: 'Recovers allowance tokens from the Safe treasury back to Powers. No parameters.',
  calldataShape: 'empty',
  encode: () => '0x',
};

const SafeAllowance_Action: MandateTemplate = {
  name: 'SafeAllowance_Action',
  category: 'integration',
  description: 'Executes a pre-configured allowance action on a Safe treasury. No parameters.',
  calldataShape: 'empty',
  encode: () => '0x',
};

const SafeAllowance_PresetTransfer: MandateTemplate = {
  name: 'SafeAllowance_PresetTransfer',
  category: 'integration',
  description: 'Transfers a fixed token amount (configured) from Safe treasury to a recipient.',
  calldataShape: 'structured',
  encode: (p) =>
    encodeAbiParameters(parseAbiParameters('address'), [p.payableTo as Address]),
};

const SafeAllowance_Transfer: MandateTemplate = {
  name: 'SafeAllowance_Transfer',
  category: 'integration',
  description: 'Transfers a specified token and amount from Safe treasury to a recipient.',
  calldataShape: 'structured',
  encode: (p) =>
    encodeAbiParameters(
      parseAbiParameters('address, uint256, address'),
      [
        p.token as Address,
        BigInt(p.amount as string),
        p.payableTo as Address,
      ]
    ),
};

// ── Integrations — GovernedToken ──────────────────────────────────────────────

const GovernedToken_BurnToAccess: MandateTemplate = {
  name: 'GovernedToken_BurnToAccess',
  category: 'integration',
  description: 'Burns an ERC-721/1155 token to gain access to a governance role.',
  calldataShape: 'structured',
  encode: (p) =>
    encodeAbiParameters(parseAbiParameters('uint256'), [BigInt(p.tokenId as string)]),
};

const GovernedToken_CollectSplitPayment: MandateTemplate = {
  name: 'GovernedToken_CollectSplitPayment',
  category: 'integration',
  description: 'Collects a split payment distribution from a Governed721 contract.',
  calldataShape: 'structured',
  encode: (p) =>
    encodeAbiParameters(parseAbiParameters('uint256'), [BigInt(p.transferId as string)]),
};

const GovernedToken_GatedAccess: MandateTemplate = {
  name: 'GovernedToken_GatedAccess',
  category: 'integration',
  description: 'Assigns a governance role by staking / proving ownership of token IDs.',
  calldataShape: 'structured',
  encode: (p) =>
    encodeAbiParameters(parseAbiParameters('uint256[]'), [
      (p.tokenIds as string[]).map(BigInt),
    ]),
};

const GovernedToken_MintEncodedToken: MandateTemplate = {
  name: 'GovernedToken_MintEncodedToken',
  category: 'integration',
  description: 'Mints a governed token (non-transferable identity token) to a specified address.',
  calldataShape: 'structured',
  encode: (p) =>
    encodeAbiParameters(parseAbiParameters('address'), [p.to as Address]),
};

// ── Integrations — Governor ───────────────────────────────────────────────────

const Governor_CreateProposal: MandateTemplate = {
  name: 'Governor_CreateProposal',
  category: 'integration',
  description: 'Creates a proposal on an OZ Governor contract.',
  calldataShape: 'structured',
  encode: (p) =>
    encodeAbiParameters(
      parseAbiParameters('address[], uint256[], bytes[], string'),
      [
        p.targets as Address[],
        (p.values as string[]).map(BigInt),
        p.calldatas as `0x${string}`[],
        p.description as string,
      ]
    ),
};

const Governor_ExecuteProposal: MandateTemplate = {
  name: 'Governor_ExecuteProposal',
  category: 'integration',
  description: 'Executes a passed OZ Governor proposal.',
  calldataShape: 'structured',
  encode: (p) =>
    encodeAbiParameters(
      parseAbiParameters('address[], uint256[], bytes[], string'),
      [
        p.targets as Address[],
        (p.values as string[]).map(BigInt),
        p.calldatas as `0x${string}`[],
        p.description as string,
      ]
    ),
};

// ── Integrations — ERC721 ─────────────────────────────────────────────────────

const ERC721_GatedAccess: MandateTemplate = {
  name: 'ERC721_GatedAccess',
  category: 'integration',
  description: 'Assigns a role if caller holds minimum required balance of a configured ERC-721. No parameters.',
  calldataShape: 'empty',
  encode: () => '0x',
};

// ── Integrations — PowersFactory ──────────────────────────────────────────────

const PowersFactory_AddSafeDelegate: MandateTemplate = {
  name: 'PowersFactory_AddSafeDelegate',
  category: 'integration',
  description: 'Post-spawn step: adds new Powers contract as Safe allowance delegate. Calldata forwarded.',
  calldataShape: 'forwarded',
  notes: 'Must follow a PowersFactory spawn mandate via needFulfilled.',
  encode: (p) => (p.rawCalldata as `0x${string}`) ?? '0x',
};

const PowersFactory_AssignRole: MandateTemplate = {
  name: 'PowersFactory_AssignRole',
  category: 'integration',
  description: 'Post-spawn step: assigns configured role on new Powers contract to original caller.',
  calldataShape: 'forwarded',
  notes: 'Must follow a PowersFactory spawn mandate via needFulfilled.',
  encode: (p) => (p.rawCalldata as `0x${string}`) ?? '0x',
};

// ── Integrations — Chainlink & ZKPassport ─────────────────────────────────────

const ChainlinkFunctions_Open: MandateTemplate = {
  name: 'ChainlinkFunctions_Open',
  category: 'integration',
  description: 'Triggers a Chainlink Functions request to evaluate off-chain data.',
  calldataShape: 'config-defined',
  notes: 'Async mandate — check action state after submission and wait for Chainlink callback.',
  encode: (p) => (p.rawCalldata as `0x${string}`) ?? '0x',
};

const ZKPassport_Check: MandateTemplate = {
  name: 'ZKPassport_Check',
  category: 'integration',
  description: 'Verifies an account holds a valid ZKPassport proof. Caller must match accountToCheck.',
  calldataShape: 'config-defined',
  notes: 'Params from config plus accountToCheck (address) appended last.',
  encode: (p) => (p.rawCalldata as `0x${string}`) ?? '0x',
};

// ── Registry ─────────────────────────────────────────────────────────────────

const ALL_TEMPLATES: MandateTemplate[] = [
  // Electoral
  SelfSelect, Nominate, PeerSelect, RenounceRole, AssignExternalRole, RoleByRoles,
  DelegateTokenSelect, RevokeAccountsRoleId, RevokeInactiveAccounts,
  // Executive
  OpenAction, PresetActions, PresetActions_OnOwnPowers, StatementOfIntent,
  BespokeAction_Simple, BespokeAction_Advanced, BespokeAction_OnReturnValue,
  CheckExternalActionState, ExternalAction_Simple, ExternalAction_Flexible,
  ExternalAction_OnReturnValue,
  // Reform
  Adopt_Mandates, Revoke_Mandates, PauseMandates, MandatePackage, MandatePackage_Static,
  // Integrations
  ElectionRegistry_Nominate, ElectionRegistry_CreateVoteMandate, ElectionRegistry_Vote,
  ElectionRegistry_Tally, ElectionRegistry_CleanUpVoteMandate,
  SlateRegistry_AddSlate, SlateRegistry_RemoveSlate, SlateRegistry_ExecuteResult,
  Safe_ExecTransaction, Safe_ExecTransaction_OnReturnValue, Safe_RecoverTokens,
  SafeAllowance_Action, SafeAllowance_PresetTransfer, SafeAllowance_Transfer,
  GovernedToken_BurnToAccess, GovernedToken_CollectSplitPayment,
  GovernedToken_GatedAccess, GovernedToken_MintEncodedToken,
  Governor_CreateProposal, Governor_ExecuteProposal,
  ERC721_GatedAccess,
  PowersFactory_AddSafeDelegate, PowersFactory_AssignRole,
  ChainlinkFunctions_Open, ZKPassport_Check,
];

const byName = new Map<string, MandateTemplate>(
  ALL_TEMPLATES.map((t) => [t.name.toLowerCase(), t])
);

export function getTemplateByName(name: string): MandateTemplate | null {
  return byName.get(name.toLowerCase()) ?? null;
}

// Fuzzy match against a mandate's nameDescription string.
// Returns the best-matching template, or null if no reasonable match is found.
export function findTemplate(nameDescription: string): MandateTemplate | null {
  const lower = nameDescription.toLowerCase();

  // Exact name match first
  const exact = byName.get(lower);
  if (exact) return exact;

  // Substring match — longest matching name wins
  let best: MandateTemplate | null = null;
  let bestLen = 0;
  for (const t of ALL_TEMPLATES) {
    const tLower = t.name.toLowerCase().replace(/_/g, ' ');
    if (lower.includes(tLower) && tLower.length > bestLen) {
      best = t;
      bestLen = tLower.length;
    }
  }

  return best;
}

export function listTemplates(): string {
  return ALL_TEMPLATES.map(
    (t) => `${t.name} (${t.category}) — ${t.description}`
  ).join('\n');
}
