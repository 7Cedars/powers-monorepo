// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
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
					label: 'For Developers',
					items: [
						{ label: 'Litepaper', slug: 'for-developers/litepaper' },
						{ label: 'Architecture', slug: 'for-developers/architecture' },
						{ label: 'Powers.sol', slug: 'for-developers/powers' },
						{ label: 'Mandate.sol', slug: 'for-developers/mandate' },
						{ label: 'Deploy Your Powers', slug: 'for-developers/deploy-your-powers' },
						{ label: 'Creating a Mandate', slug: 'for-developers/creating-a-mandate' },
					],
				},
			],
		}),
	],
});
