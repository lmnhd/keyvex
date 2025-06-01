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

      // Exclude Babel from client-side bundling to prevent browserslist errors
      if (!isServer) {
        config.resolve.fallback = {
          ...config.resolve.fallback,
          '@babel/core': false,
          '@babel/preset-react': false,
          '@babel/preset-typescript': false,
          'browserslist': false,
        };
      }

      return config;
    },
  }),

  // Production webpack configuration
  webpack: (config, { dev, isServer }) => {
    // Apply development config if in development
    if (dev) {
      config.devtool = 'eval-source-map';
      config.optimization = {
        ...config.optimization,
        minimize: false,
      };
    }

    // Always exclude Babel from client-side bundling
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        '@babel/core': false,
        '@babel/preset-react': false,
        '@babel/preset-typescript': false,
        'browserslist': false,
      };
    }

    return config;
  },

  // Enable source maps for production debugging if needed
  productionBrowserSourceMaps: false, // Set to true if you need production debugging
};

export default nextConfig;
