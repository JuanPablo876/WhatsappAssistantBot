/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable standalone output for Electron packaging
  output: 'standalone',
  // Allow server-side Node.js modules (baileys, googleapis, etc.)
  serverExternalPackages: [
    '@whiskeysockets/baileys',
    '@prisma/client',
    'googleapis',
    'pino',
    'pino-pretty',
    'qrcode-terminal',
    'qrcode',
    'node-cron',
    'bcryptjs',
    'jsonwebtoken',
  ],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' }, // Google profile pics
    ],
  },
};

export default nextConfig;
