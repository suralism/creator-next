/** @type {import('next').NextConfig} */
const nextConfig = {
    // Allow serving files from the data directory
    async rewrites() {
        return [];
    },
    // Enable server-side features
    serverExternalPackages: ['@libsql/client', 'googleapis', 'multer'],
};

export default nextConfig;
