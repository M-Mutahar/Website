/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Node-native packages that shouldn't be run through webpack's bundler
    // for server components/route handlers — bundling tesseract.js/pdf-parse
    // incorrectly is a known source of Vercel build/runtime failures.
    serverComponentsExternalPackages: ["@prisma/client", "tesseract.js", "pdf-parse"],
  },
};

export default nextConfig;
