import { getBrand } from "@/lib/brand";

/** Favicon fallback: the first letter of the brand name on the accent colour. */
export async function GET() {
  const b = await getBrand();
  const letter = (b.name.trim()[0] || "L").toUpperCase().replace(/[<>&"']/g, "");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="${b.primary}"/><text x="16" y="22.5" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-weight="700" font-size="19" fill="#fff">${letter}</text></svg>`;
  return new Response(svg, { headers: { "content-type": "image/svg+xml", "cache-control": "public, max-age=300" } });
}
