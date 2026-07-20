const reactHooksPlugin = require('eslint-plugin-react-hooks');
const nextPlugin = require('@next/eslint-plugin-next');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');
const globals = require('globals');

module.exports = [
  // Global ignores
  {
    ignores: [
      '.eslintrc.js',
      '.next/**',
      '.next-e2e/**',
      'out/**',
      'build/**',
      'dist/**',
      'playwright-report/**',
      'test-results/**',
      'next-env.d.ts',
      'public/sw.js',
      'public/workbox-*.js',
      'public/orgMetadatas/**',
      'public/roleThumbnails/**',
      'app/source.js',
      '*.config.js',
      '*.config.mjs',
    ],
  },
  // React Hooks flat config
  reactHooksPlugin.configs.flat.recommended,
  // Next.js core web vitals rules
  nextPlugin.configs['core-web-vitals'],
  // TypeScript ESLint recommended (flat config variant)
  ...tsPlugin.configs['flat/recommended'],
  // Custom rules, settings, and globals
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2021,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        importScripts: 'readonly',
        define: 'readonly',
        registration: 'readonly',
        FetchEvent: 'readonly',
        _: 'readonly',
        React: 'readonly',
        NodeJS: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/ban-ts-comment': 'warn',

      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      'no-console': 'off',
      'no-debugger': 'error',
      'prefer-const': 'warn',
      'no-var': 'error',
      'object-shorthand': 'warn',
      'prefer-template': 'warn',
      'no-empty': 'warn',
      'no-cond-assign': 'warn',
      'no-func-assign': 'error',
      'no-mixed-spaces-and-tabs': 'error',
      'no-case-declarations': 'warn',
      'no-sparse-arrays': 'warn',
      'no-useless-escape': 'warn',
      'valid-typeof': 'warn',

      '@next/next/no-img-element': 'warn',
    },
  },
];
