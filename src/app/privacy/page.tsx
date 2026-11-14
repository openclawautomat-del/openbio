import { getBrand } from "@/lib/brand";
import { getLegal } from "@/lib/legal";
import { SiteShell, LegalText } from "@/components/site-shell";

export const metadata = { title: "Privacy" };

export default async function Privacy() {
  const b = await getBrand();
  return (
    <SiteShell>
      <h1>Privacy</h1>
      <div className="prose"><LegalText text={await getLegal("privacy", b)} /></div>
    </SiteShell>
  );
}
