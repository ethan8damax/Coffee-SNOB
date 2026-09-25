import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@coffeesnob/coffee-index", "@coffeesnob/design-tokens", "@coffeesnob/supabase"],
  // Both hostnames resolve to this project, so pick one canonical origin —
  // otherwise every page exists at two URLs and search engines split them.
  // Permanent (308), since www is never coming back as the real home.
  // The coffee index (monthly static tiles on Cloudflare R2) is served
  // through this site so Vercel's CDN caches it and the app has one stable
  // URL. COFFEE_INDEX_ORIGIN is the bucket's public URL; unset → no route.
  async rewrites() {
    const origin = process.env.COFFEE_INDEX_ORIGIN;
    return origin ? [{ source: "/coffee-index/:path*", destination: `${origin.replace(/\/$/, "")}/:path*` }] : [];
  },
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
