import { getBrand } from "@/lib/brand";
import { getLegal } from "@/lib/legal";
import { SiteShell, LegalText } from "@/components/site-shell";

export const metadata = { title: "Terms of use" };

export default async function Terms() {
  const b = await getBrand();
  return (
    <SiteShell>
      <h1>Terms of use</h1>
      <div className="prose"><LegalText text={await getLegal("terms", b)} /></div>
    </SiteShell>
  );
}
