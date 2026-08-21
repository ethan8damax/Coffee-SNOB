import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@coffeesnob/design-tokens", "@coffeesnob/supabase"],
};

export default nextConfig;
