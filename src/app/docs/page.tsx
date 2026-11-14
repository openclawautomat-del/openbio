import type { Metadata } from "next";
import { getBrand } from "@/lib/brand";
import { SiteShell } from "@/components/site-shell";

export const metadata: Metadata = { title: "API reference" };

function Endpoint({ id, method, path, children }: { id: string; method: "get" | "post" | "patch" | "delete"; path: string; children: React.ReactNode }) {
  return (
    <section id={id}>
      <h2><span className={`method ${method}`}>{method.toUpperCase()}</span><code>{path}</code></h2>
      {children}
    </section>
  );
}

export default async function Docs() {
  const b = await getBrand();
  const base = `${b.url}/api/v1`;
  return (
    <SiteShell wide>
      <div className="docs">
        <nav aria-label="API sections">
          <a href="#auth">Authentication</a>
          <a href="#errors">Errors and limits</a>
          <a href="#list">List links</a>
          <a href="#create">Create a link</a>
          <a href="#get">Get a link</a>
          <a href="#update">Update a link</a>
          <a href="#delete">Delete a link</a>
          <a href="#link-stats">Link stats</a>
          <a href="#stats">Account stats</a>
          <a href="#page">Bio page</a>
        </nav>
        <div>
          <h1>API reference</h1>
          <p>Everything below is JSON over HTTPS. Base URL: <code>{base}</code></p>

          <section id="auth">
            <h2>Authentication</h2>
            <p>Create a key under <em>API keys</em> in your dashboard and send it as a bearer token. Keys start with <code>ob_</code>. Revoking a key cuts it off at once.</p>
            <pre className="code">{`curl ${base}/links \\
  -H "Authorization: Bearer ob_your_key"`}</pre>
          </section>

          <section id="errors">
            <h2>Errors and limits</h2>
            <p>Failures return a non-2xx status and a body shaped like this:</p>
            <pre className="code">{`{ "error": { "message": "Validation failed.", "fields": { "slug": "That short name is already taken." } } }`}</pre>
            <p>Each key gets a fixed number of requests per minute (the server owner sets it; the default is 60). Past that you get <code>429</code> with a <code>Retry-After</code> header.</p>
          </section>

          <Endpoint id="list" method="get" path="/links">
            <p>Your links, newest first. Query: <code>q</code> (search), <code>page</code>, <code>limit</code> (max 100).</p>
            <pre className="code">{`curl "${base}/links?q=launch&limit=10" -H "Authorization: Bearer ob_your_key"`}</pre>
            <pre className="code">{`{
  "data": [{
    "id": 12,
    "slug": "launch",
    "short_url": "${b.url}/launch",
    "target_url": "https://example.com/launch-day",
    "title": "Launch day",
    "password_protected": false,
    "enabled": true,
    "starts_at": null,
    "expires_at": null,
    "created_at": "2026-03-02T09:14:00.000Z"
  }],
  "meta": { "total": 1, "page": 1, "limit": 10 }
}`}</pre>
          </Endpoint>

          <Endpoint id="create" method="post" path="/links">
            <p>Only <code>target_url</code> is required. Leave <code>slug</code> out to get a random one.</p>
            <pre className="code">{`curl -X POST ${base}/links \\
  -H "Authorization: Bearer ob_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "target_url": "https://example.com/launch-day",
    "slug": "launch",
    "title": "Launch day",
    "password": "optional",
    "starts_at": "2026-03-01T00:00:00Z",
    "expires_at": "2026-04-01T00:00:00Z"
  }'`}</pre>
            <p>Returns <code>201</code> with the link. A taken slug or a blocked destination returns <code>422</code>.</p>
          </Endpoint>

          <Endpoint id="get" method="get" path="/links/{id}">
            <p>One link by numeric id.</p>
          </Endpoint>

          <Endpoint id="update" method="patch" path="/links/{id}">
            <p>Send only the fields to change. Set <code>password</code> to an empty string to remove protection, or <code>expires_at</code> to <code>null</code> to clear the expiry. <code>enabled: false</code> pauses the link.</p>
            <pre className="code">{`curl -X PATCH ${base}/links/12 \\
  -H "Authorization: Bearer ob_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{ "enabled": false }'`}</pre>
          </Endpoint>

          <Endpoint id="delete" method="delete" path="/links/{id}">
            <p>Deletes the link and its click history. Returns <code>204</code>.</p>
          </Endpoint>

          <Endpoint id="link-stats" method="get" path="/links/{id}/stats">
            <p>Totals, a daily series and breakdowns for one link. Query: <code>days</code> (1 to 365, default 30).</p>
            <pre className="code">{`{
  "data": {
    "total": 214,
    "unique": 171,
    "series": [{ "day": "2026-03-02", "total": 9, "unique": 7 }],
    "countries": [{ "label": "DE", "n": 80 }],
    "devices": [{ "label": "Mobile", "n": 150 }],
    "browsers": [{ "label": "Safari", "n": 90 }],
    "referrers": [{ "label": "Direct", "n": 120 }],
    "campaigns": [{ "label": "No campaign", "n": 214 }]
  }
}`}</pre>
          </Endpoint>

          <Endpoint id="stats" method="get" path="/stats">
            <p>The same shape, across everything you own. Query: <code>days</code>, and <code>kind</code> set to <code>clicks</code> (default) or <code>views</code> for bio page visits.</p>
          </Endpoint>

          <Endpoint id="page" method="get" path="/page">
            <p>Your bio page settings and its blocks. <code>PATCH /page</code> accepts the same profile fields as the editor: <code>display_name</code>, <code>bio</code>, <code>theme</code>, <code>published</code>.</p>
          </Endpoint>
        </div>
      </div>
    </SiteShell>
  );
}
