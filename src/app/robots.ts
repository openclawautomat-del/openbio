import type { MetadataRoute } from "next";
import { getBrand } from "@/lib/brand";

export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const b = await getBrand();
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/dashboard", "/admin", "/api/", "/install", "/out/", "/login", "/register"] }],
    sitemap: `${b.url}/sitemap.xml`,
    host: b.url,
  };
}
