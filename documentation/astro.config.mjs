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
			title: 'Powers',
			social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/7Cedars/powers' }],
			sidebar: [
				{
					label: 'Getting Started',
					items: [
						{ label: 'Intro', slug: 'index' },
						{ label: 'Welcome', slug: 'welcome' },
						{ label: 'Use Cases', slug: 'use-cases' },
						{ label: 'Development', slug: 'development' },
					],
				},
				{
					label: 'For Organisations',
					items: [
						{ label: 'Deploy your Powers', slug: 'for-organisations/deploy-powers-editor' },
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
								{ label: 'Open Action', slug: 'mandates/executive/openaction' },
								{ label: 'Statement of Intent', slug: 'mandates/executive/statementofintent' },
							],
						},
						{
							label: 'Integrations',
							collapsed: true,
							items: [
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
									label: 'Github',
									collapsed: true,
									items: [
										{ label: 'Assign Role With Sig', slug: 'mandates/integrations/github/github_assignrolewithsig' },
										{ label: 'Claim Role With Sig', slug: 'mandates/integrations/github/github_claimrolewithsig' },
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
										{ label: 'Safe Allowance Transfer', slug: 'mandates/integrations/safe/safeallowance_transfer' },
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
										{ label: 'Select', slug: 'mandates/integrations/zkpassport/zkpassport_select' },
									],
								},
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
