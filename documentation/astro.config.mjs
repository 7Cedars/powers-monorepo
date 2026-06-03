// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	vite: {
		ssr: {
			noExternal: ['@astrojs/starlight', '@ctrl/tinycolor']
		}
	},
	integrations: [
		starlight({
			title: 'Powers Protocol',
			logo: {
				src: './src/assets/powers-icon.svg',
				alt: 'Powers Protocol',
			},
			customCss: ['./src/styles/custom.css'],
			head: [
				{ tag: 'link', attrs: { rel: 'preconnect', href: 'https://fonts.googleapis.com' } },
				{ tag: 'link', attrs: { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: true } },
				{ tag: 'link', attrs: { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400&display=block' } },
				{ tag: 'link', attrs: { rel: 'preload', as: 'font', type: 'font/otf', href: '/fonts/CommitMono-400-Regular.otf', crossorigin: true } },
				{ tag: 'link', attrs: { rel: 'preload', as: 'font', type: 'font/otf', href: '/fonts/CommitMono-700-Regular.otf', crossorigin: true } },
				{
					tag: 'script',
					content: `
						function setupHeadingAnchors() {
							document.querySelectorAll('.sl-anchor-link').forEach(anchor => {
								if (anchor.dataset.copyBound) return;
								anchor.dataset.copyBound = 'true';
								anchor.addEventListener('click', (e) => {
									e.preventDefault();
									const url = location.origin + location.pathname + anchor.getAttribute('href');
									const markCopied = () => {
										anchor.dataset.copied = 'true';
										setTimeout(() => delete anchor.dataset.copied, 2000);
									};
									navigator.clipboard.writeText(url).then(markCopied).catch(() => {
										try {
											const el = Object.assign(document.createElement('textarea'), { value: url });
											document.body.appendChild(el);
											el.select();
											document.execCommand('copy');
											el.remove();
											markCopied();
										} catch {}
									});
								});
							});
						}
						document.addEventListener('DOMContentLoaded', setupHeadingAnchors);
						document.addEventListener('astro:page-load', setupHeadingAnchors);
					`,
				},
			],
			social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/7Cedars/powers' }],
			sidebar: [
				{
					label: 'Getting Started',
					items: [
						{ label: 'Welcome', slug: 'welcome' },
						{ label: 'Development', slug: 'development' },
					],
				},
				{
					label: 'For Organisations',
					items: [
						{ label: 'Deploy your Powers', slug: 'for-organisations/deploy-powers' },
						{ label: 'Best Practices', slug: 'for-organisations/best-practices' },
						{ label: 'Compliance', slug: 'for-organisations/compliance' }
					],
				},
				{
					label: 'For Developers',
					items: [
						{ label: 'Litepaper', slug: 'for-developers/litepaper' },
						{ label: 'Architecture', slug: 'for-developers/architecture' },
						{ label: 'Powers.sol', slug: 'for-developers/powers' },
						{ label: 'Mandate.sol', slug: 'for-developers/mandate' },
						{ label: 'Creating a Mandate', slug: 'for-developers/creating-a-mandate' },
						{ label: 'Deploy Powers with a Foundry Script', slug: 'for-developers/deploy-powers-script' },
					],
				},
				{
					label: 'Mandates',
					items: [
						{
							label: 'Electoral',
							collapsed: true,
							items: [
								{ label: 'Assign External Role', slug: 'mandates/electoral/assignexternalrole' },
								{ label: 'Delegate Token Select', slug: 'mandates/electoral/delegatetokenselect' },
								{ label: 'Nominate', slug: 'mandates/electoral/nominate' },
								{ label: 'Peer Select', slug: 'mandates/electoral/peerselect' },
								{ label: 'Renounce Role', slug: 'mandates/electoral/renouncerole' },
								{ label: 'Revoke Accounts Role Id', slug: 'mandates/electoral/revokeaccountsroleid' },
								{ label: 'Revoke Inactive Accounts', slug: 'mandates/electoral/revokeinactiveaccounts' },
								{ label: 'Role By Roles', slug: 'mandates/electoral/rolebyroles' },
								{ label: 'Self Select', slug: 'mandates/electoral/selfselect' },
							],
						},
						{
							label: 'Executive',
							collapsed: true,
							items: [
								{ label: 'Bespoke Action (Advanced)', slug: 'mandates/executive/bespokeaction_advanced' },
								{ label: 'Bespoke Action (On Return Value)', slug: 'mandates/executive/bespokeaction_onreturnvalue' },
								{ label: 'Bespoke Action (Simple)', slug: 'mandates/executive/bespokeaction_simple' },
								{ label: 'Check External Action State', slug: 'mandates/executive/checkexternalactionstate' },
								{ label: 'External Action (Flexible)', slug: 'mandates/executive/externalaction_flexible' },
								{ label: 'External Action (On Return Value)', slug: 'mandates/executive/externalaction_onreturnvalue' },
								{ label: 'External Action (Simple)', slug: 'mandates/executive/externalaction_simple' },
								{ label: 'Open Action', slug: 'mandates/executive/openaction' },
								{ label: 'Preset Actions', slug: 'mandates/executive/presetactions' },
								{ label: 'Preset Actions (On Own Powers)', slug: 'mandates/executive/presetactions_onownpowers' },
								{ label: 'Statement of Intent', slug: 'mandates/executive/statementofintent' },
							],
						},
						{
							label: 'Integrations',
							collapsed: true,
							items: [
								{
									label: 'Chainlink',
									collapsed: true,
									items: [
										{ label: 'Chainlink Functions (Open)', slug: 'mandates/integrations/chainlink/chainlinkfunctions_open' },
									],
								},
								{
									label: 'Election List',
									collapsed: true,
									items: [
										{ label: 'Clean Up Vote Mandate', slug: 'mandates/integrations/election-list/electionlist_cleanupvotemandate' },
										{ label: 'Create Vote Mandate', slug: 'mandates/integrations/election-list/electionlist_createvotemandate' },
										{ label: 'Nominate', slug: 'mandates/integrations/election-list/electionlist_nominate' },
										{ label: 'Tally', slug: 'mandates/integrations/election-list/electionlist_tally' },
										{ label: 'Vote', slug: 'mandates/integrations/election-list/electionlist_vote' },
									],
								},
								{
									label: 'ERC721',
									collapsed: true,
									items: [
										{ label: 'Gated Access', slug: 'mandates/integrations/erc721/erc721_gatedaccess' },
									],
								},
								{
									label: 'Governed Token',
									collapsed: true,
									items: [
										{ label: 'Burn To Access', slug: 'mandates/integrations/governed-token/governedtoken_burntoaccess' },
										{ label: 'Collect Split Payment', slug: 'mandates/integrations/governed-token/governedtoken_collectsplitpayment' },
										{ label: 'Gated Access', slug: 'mandates/integrations/governed-token/governedtoken_gatedaccess' },
										{ label: 'Mint Encoded Token', slug: 'mandates/integrations/governed-token/governedtoken_mintencodedtoken' },
									],
								},
								{
									label: 'Governor',
									collapsed: true,
									items: [
										{ label: 'Create Proposal', slug: 'mandates/integrations/governor/governor_createproposal' },
										{ label: 'Execute Proposal', slug: 'mandates/integrations/governor/governor_executeproposal' },
									],
								},
								{
									label: 'Powers Factory',
									collapsed: true,
									items: [
										{ label: 'Add Safe Delegate', slug: 'mandates/integrations/powers-factory/powersfactory_addsafedelegate' },
										{ label: 'Assign Role', slug: 'mandates/integrations/powers-factory/powersfactory_assignrole' },
									],
								},
								{
									label: 'Safe',
									collapsed: true,
									items: [
										{ label: 'Exec Transaction', slug: 'mandates/integrations/safe/safe_exectransaction' },
										{ label: 'Exec Transaction (On Return Value)', slug: 'mandates/integrations/safe/safe_exectransaction_onreturnvalue' },
										{ label: 'Recover Tokens', slug: 'mandates/integrations/safe/safe_recovertokens' },
										{ label: 'Safe Allowance Action', slug: 'mandates/integrations/safe/safeallowance_action' },
										{ label: 'Safe Allowance Preset Transfer', slug: 'mandates/integrations/safe/safeallowance_presettransfer' },
										{ label: 'Safe Allowance Transfer', slug: 'mandates/integrations/safe/safeallowance_transfer' },
									],
								},
								{
									label: 'Slate Registry',
									collapsed: true,
									items: [
										{ label: 'Add Slate', slug: 'mandates/integrations/slate-registry/slateregistry_addslate' },
										{ label: 'Execute Result', slug: 'mandates/integrations/slate-registry/slateregistry_executeresult' },
										{ label: 'Remove Slate', slug: 'mandates/integrations/slate-registry/slateregistry_removeslate' },
									],
								},
								{
									label: 'Snapshot',
									collapsed: true,
									items: [
										{ label: 'Check Snap Exists', slug: 'mandates/integrations/snapshot/snapshot_checksnapexists' },
										{ label: 'Check Snap Passed', slug: 'mandates/integrations/snapshot/snapshot_checksnappassed' },
									],
								},
								{
									label: 'ZK Passport',
									collapsed: true,
									items: [
										{ label: 'ZKPassport Check', slug: 'mandates/integrations/zkpassport/zkpassport_check' },
									],
								},
							],
						},
					{
						label: 'Reform',
						collapsed: true,
						items: [
							{ label: 'Adopt Mandates', slug: 'mandates/reform/adopt_mandates' },
							{ label: 'Mandate Package', slug: 'mandates/reform/mandatepackage' },
							{ label: 'Mandate Package (Static)', slug: 'mandates/reform/mandatepackage_static' },
							{ label: 'Pause Mandates', slug: 'mandates/reform/pausemandates' },
							{ label: 'Revoke Mandates', slug: 'mandates/reform/revoke_mandates' },
						],
					},
					],
				},
				{
					label: 'Example Organisations',
					items: [
						{ label: 'Powers 101', slug: 'example-organisations/powers101' },
						{ label: 'Governed 721', slug: 'example-organisations/governed721' },
						{ label: 'Cultural Stewards Experiment', slug: 'example-organisations/cultural-stewards' }
					],
				},
				

			],
		}),
	],
});
