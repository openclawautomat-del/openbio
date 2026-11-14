"use client";

import "./bio.css";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="main" className="gone">
      <div className="gone-box" role="alert">
        <h1>Something broke on our side</h1>
        <p>The page could not be loaded. Trying again often fixes it. If it keeps happening, tell the administrator{error.digest ? ` and mention reference ${error.digest}` : ""}.</p>
        <p><button className="btn btn-primary" onClick={reset}>Try again</button></p>
      </div>
    </main>
  );
}
