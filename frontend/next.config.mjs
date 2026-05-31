/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'jdwuphxkoflzeuvmtkkf.supabase.co',
      },
    ],
  },
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
  turbopack: {},
};

export default nextConfig;