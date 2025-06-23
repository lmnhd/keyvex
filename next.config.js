/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  serverExternalPackages: ['@aws-sdk', 'sonic-boom', 'pino'],
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Exclude Node.js-specific modules from client bundle
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        os: false,
        path: false,
        stream: false,
        util: false,
        events: false,
      };
    }
    return config;
  },
  env: {
    DYNAMODB_TABLE_NAME: process.env.DYNAMODB_TABLE_NAME || 'keyvex-main-table-development',
    AWS_REGION: process.env.AWS_REGION || 'us-east-1',
  },
}

module.exports = nextConfig 