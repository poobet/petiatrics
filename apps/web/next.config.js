import createNextIntlPlugin from 'next-intl/plugin';
const withNextIntl = createNextIntlPlugin('./i18n.ts');
const nextConfig = {
    // Enable standalone output for Docker deployment
    output: 'standalone',
    // Transpile internal workspace packages
    transpilePackages: ['@petiatrics/ui', '@petiatrics/types', '@petiatrics/config'],
    // Image optimization -- use modern formats for smaller payload
    images: {
        formats: ['image/avif', 'image/webp'],
        minimumCacheTTL: 86400,
        deviceSizes: [320, 420, 640, 768, 1024, 1280],
        imageSizes: [16, 32, 48, 64, 96, 128, 256],
    },
    // Package import optimization -- tree-shake large icon libraries
    experimental: {
        optimizePackageImports: ['lucide-react'],
    },
    // Resolve .ts/.tsx before .js/.jsx so transpilePackages works against TypeScript sources
    // without requiring pre-compiled .js artifacts in each package's src/ directory.
    webpack(config) {
        config.resolve.extensionAlias = {
            '.js': ['.ts', '.tsx', '.js', '.jsx'],
            '.jsx': ['.tsx', '.jsx'],
        };
        return config;
    },
    // Proxy /api/v1/* to the NestJS backend so the browser cookie stays on the same origin
    async rewrites() {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
        return [
            {
                source: '/api/v1/:path*',
                destination: `${apiUrl}/api/v1/:path*`,
            },
        ];
    },
    // Security + performance headers
    async headers() {
        return [
            {
                source: '/(.*)',
                headers: [
                    { key: 'X-Frame-Options', value: 'DENY' },
                    { key: 'X-Content-Type-Options', value: 'nosniff' },
                    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
                    {
                        key: 'Permissions-Policy',
                        value: 'camera=(), microphone=(), geolocation=()',
                    },
                ],
            },
            // Long-lived immutable cache for compiled assets
            {
                source: '/_next/static/:path*',
                headers: [
                    { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
                ],
            },
            // PWA manifest cache
            {
                source: '/manifest.json',
                headers: [
                    { key: 'Cache-Control', value: 'public, max-age=86400' },
                ],
            },
        ];
    },
};
export default withNextIntl(nextConfig);
