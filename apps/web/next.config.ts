import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@coffeesnob/design-tokens", "@coffeesnob/supabase"],
  // Both hostnames resolve to this project, so pick one canonical origin —
  // otherwise every page exists at two URLs and search engines split them.
  // Permanent (308), since www is never coming back as the real home.
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.coffeesnobproject.com" }],
        destination: "https://coffeesnobproject.com/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
