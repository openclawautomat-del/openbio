import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  // Explicit alias so the "@/" imports resolve whichever TypeScript version Next finds.
  webpack(config) {
    config.resolve.alias = { ...config.resolve.alias, "@": path.join(root, "src") };
    return config;
  },
  serverExternalPackages: ["mysql2", "nodemailer", "bcryptjs"],
  outputFileTracingIncludes: {
    "/**": ["./migrations/**/*"],
  },
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
  async headers() {
    const csp = [
      "default-src 'self'",
      "img-src 'self' data: blob: https:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline'" + (process.env.NODE_ENV === "production" ? "" : " 'unsafe-eval'"),
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-src https://www.youtube-nocookie.com https://open.spotify.com https://www.google.com https://player.vimeo.com",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ");
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
    ];
  },
};
export default nextConfig;
