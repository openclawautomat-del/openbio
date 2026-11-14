# REST API

JSON over HTTPS. Base URL: `{APP_URL}/api/v1`. The same reference, with your real URL filled in, is served by your install at `/docs`.

## Authentication

Create a key under **API keys** in the dashboard. Keys start with `ob_`. Send it as a bearer token:

```bash
curl https://your-domain/api/v1/links -H "Authorization: Bearer ob_your_key"
```

Revoking a key cuts it off immediately. Only a hash of each key is stored, so a lost key cannot be shown again.

## Errors

Failures return a non-2xx status and:

```json
{ "error": { "message": "Validation failed.", "fields": { "slug": "That short name is already taken." } } }
```

## Rate limits

Each key gets a fixed number of requests per minute (default 60, set by the server owner in **Admin > Settings > API**). Past it you get `429` with a `Retry-After` header.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/links` | List your links. Query: `q`, `page`, `limit` (max 100) |
| POST | `/links` | Create a link. Only `target_url` is required |
| GET | `/links/{id}` | One link |
| PATCH | `/links/{id}` | Change fields; send only what changes |
| DELETE | `/links/{id}` | Delete the link and its clicks. Returns 204 |
| GET | `/links/{id}/stats` | Stats for one link. Query: `days` (1 to 365) |
| GET | `/stats` | Stats across everything you own. Query: `days`, `kind` (`clicks` or `views`) |
| GET | `/page` | Your bio page and blocks |
| PATCH | `/page` | `display_name`, `bio`, `theme`, `published` |

### Create a link

```bash
curl -X POST https://your-domain/api/v1/links \
  -H "Authorization: Bearer ob_your_key" \
  -H "Content-Type: application/json" \
  -d '{"target_url":"https://example.com/launch","slug":"launch","title":"Launch page"}'
```

Returns `201` with the link. A taken slug, a blocked destination or a private address returns `422`.

Optional fields: `slug`, `title`, `password`, `starts_at`, `expires_at` (UTC, ISO 8601), `enabled`.

### Update a link

Set `password` to an empty string to remove protection, `expires_at` to `null` to clear expiry, and `enabled` to `false` to pause the link.

### Stats shape

```json
{
  "total": 120,
  "unique": 87,
  "series": [{ "day": "2026-01-30", "total": 12, "unique": 9 }],
  "countries": [{ "label": "US", "n": 40 }],
  "devices": [{ "label": "mobile", "n": 70 }],
  "browsers": [{ "label": "Chrome", "n": 60 }],
  "referrers": [{ "label": "news.example", "n": 20 }],
  "campaigns": [{ "label": "spring", "n": 15 }]
}
```
