/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'standalone',
    // Allow serving files from the data directory
    async rewrites() {
        return [];
    },
    // Enable server-side features
    serverExternalPackages: ['@libsql/client', 'googleapis', 'multer'],
};

export default nextConfig;
