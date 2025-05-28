import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Development-specific configurations
  ...(process.env.NODE_ENV === 'development' && {
    // Enable source maps in development
    webpack: (config, { dev, isServer }) => {
      if (dev) {
        config.devtool = 'eval-source-map';
        
        // Ensure source maps work properly with debugging
        config.optimization = {
          ...config.optimization,
          minimize: false,
        };
      }
      return config;
    },
  }),

  // Enable source maps for production debugging if needed
  productionBrowserSourceMaps: false, // Set to true if you need production debugging
};

export default nextConfig;
