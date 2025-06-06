/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  serverExternalPackages: ['@aws-sdk'],
  env: {
    DYNAMODB_TABLE_NAME: process.env.DYNAMODB_TABLE_NAME || 'keyvex-main-table-development',
    AWS_REGION: process.env.AWS_REGION || 'us-east-1',
  },
}

module.exports = nextConfig 