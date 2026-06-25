import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
    // E2E builds use a separate output dir so they never share (or get
    // reused from) the same webpack cache as a normal build/dev session —
    // otherwise a stale cache can leak the E2E_MOCK_AUTH Privy alias below
    // into a real production build.
    distDir: process.env.E2E_MOCK_AUTH === 'true' ? '.next-e2e' : '.next',

    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'aqua-famous-sailfish-288.mypinata.cloud',
                pathname: '/ipfs/**',
            }
        ],
    },
    
    webpack: (config, { isServer }) => {
        // Exclude test files and test dependencies from bundle
        config.module.rules.push({
            test: /node_modules\/(thread-stream|pino).*\/(test|bench).*\.(js|mjs|ts|tsx)$/,
            type: 'javascript/auto',
            use: 'null-loader'
        });
        
        // Ignore LICENSE files and other non-JS files in node_modules
        config.module.rules.push({
            test: /node_modules\/.*\/(LICENSE|README\.md|\.zip|\.sh|\.yml)$/,
            type: 'javascript/auto',
            use: 'null-loader'
        });
        
        // Add resolve fallbacks for node modules
        config.resolve.fallback = {
            ...config.resolve.fallback,
            fs: false,
            net: false,
            tls: false,
        };
        
        // Ignore react-native dependencies
        config.resolve.alias = {
            ...config.resolve.alias,
            '@react-native-async-storage/async-storage': false,
        };

        // E2E builds only: swap Privy's auth hooks for a test-controlled mock
        // so Playwright can simulate a connected wallet without going through
        // the real login flow (email OTP / wallet popup can't be automated).
        if (process.env.E2E_MOCK_AUTH === 'true') {
            config.resolve.alias = {
                ...config.resolve.alias,
                '@privy-io/react-auth/smart-wallets$': new URL('./e2e/mocks/privy-smart-wallets-mock.tsx', import.meta.url).pathname,
                '@privy-io/react-auth$': new URL('./e2e/mocks/privy-react-auth-mock.tsx', import.meta.url).pathname,
                // Aliasing the '@/...' tsconfig-style specifier directly doesn't work:
                // Next.js registers its own unsuffixed '@' -> project-root alias ahead of
                // this one, so it rewrites the request to an absolute path first and this
                // entry never gets a chance to match. Alias the resolved absolute path
                // instead, which webpack re-checks against resolve.alias after that rewrite.
                [`${path.join(__dirname, 'hooks/useXmtpClient')}$`]: new URL('./e2e/mocks/xmtp-client-mock.tsx', import.meta.url).pathname,
            };
        }
        
        // Enable WASM support for XMTP SDK
        config.experiments = {
            ...config.experiments,
            asyncWebAssembly: true,
        };
        
        return config;
    }
};

export default nextConfig;
