/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
      };
      config.resolve.alias = {
        ...config.resolve.alias,
        "supports-color": false,
        "debug": false,
      };
    }

    // ignore warnings from import traces in the terminal
    config.ignoreWarnings = [
      { module: /node_modules\/axios/ },
      { module: /node_modules\/debug/ }
    ];

    return config;
  },
};

export default nextConfig;