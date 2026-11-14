import Link from "next/link";
import { getBrand } from "@/lib/brand";
import "./bio.css";

export default async function NotFound() {
  const b = await getBrand();
  return (
    <main id="main" className="gone">
      <div className="gone-box">
        <p className="slug">{b.host}<b>/</b>?</p>
        <h1>Nothing lives at this address</h1>
        <p>The link may have been mistyped, or its owner removed it.</p>
        <p><Link className="btn" href="/">Back to {b.name}</Link></p>
      </div>
    </main>
  );
}
