# Brandly Backend (n8n)

Brandly (Next.js) is the frontend. When `N8N_WEBHOOK_BASE_URL` is set, its `/api/*` routes
forward each request to the **Brandly Backend** n8n workflow (`brandly-backend.workflow.json`).
Remove that variable to use the built-in API routes again.

```
Browser ──> Brandly /api/<route> ──(X-Brandly-Secret)──> n8n webhook brandly-<route> ──> Gemini / Ayrshare
```

| Brandly route         | n8n webhook (POST)        | What n8n does                                                        |
|-----------------------|---------------------------|----------------------------------------------------------------------|
| `/api/analyse-brand`  | `brandly-analyse-brand`   | Fetches the website, extracts colours/fonts/copy, builds Brand DNA   |
| `/api/analyse-pdf`    | `brandly-analyse-pdf`     | Gemini vision over up to 8 rasterised PDF pages                      |
| `/api/generate-post`  | `brandly-generate-post`   | Generates the full post package                                      |
| `/api/automation`     | `brandly-automation`      | Reads the RSS feed / product page, then generates a post             |
| `/api/generate-image` | `brandly-generate-image`  | On-brand image via Pollinations (backup: Alibaba Qwen-Image)         |
| `/api/publish`        | `brandly-publish`         | Publishes to Instagram, Facebook, LinkedIn and X through Ayrshare    |

Responses keep the original Brandly shapes (`{ dna }`, `{ insights }`, `{ post }`), so the pages did not change.

## Setup

1. **Import** `brandly-backend.workflow.json` in n8n (Workflows → Import from file).
2. **Credentials** (n8n → Credentials):
   - **Brandly Webhook Secret**: *Header Auth*, name `X-Brandly-Secret`, value = a long random string.
     Attach it to the five webhook nodes.
   - **Google Gemini (PaLM) API**: attach to **Call Gemini**. The model is set in that node's URL
     (`gemini-3.5-flash`). Change it there if a model is overloaded or unavailable.
   - **Pollinations API Key**: *Header Auth*, name `Authorization`, value `Bearer sk_...`.
     Attach to **Pollinations: Generate Image** (main image provider, model `tongyi-mai/z-image-turbo`).
     Images are hosted permanently on `media.pollinations.ai`. Usage is billed in pollen.
   - **Alibaba Model Studio API Key**: *Header Auth*, name `Authorization`, value `Bearer <your key>`.
     Attach to **Alibaba: Generate Image** (backup, used only if Pollinations fails). International
     (Singapore) endpoint, model `qwen-image-3.0`. Its image links expire after 24 hours.
     Models for both providers are set at the top of **Build: Image Request**.
   - **Ayrshare API Key**: *Header Auth*, name `Authorization`, value `Bearer <your Ayrshare key>`.
     Attach to **Ayrshare: Publish**. Link your social accounts in the Ayrshare dashboard.
     For multiple clients (Ayrshare Business), send `profileKey` in the publish request body.
3. **Publish/activate** the workflow.
4. In Brandly's `.env.local`:
   ```
   N8N_WEBHOOK_BASE_URL=http://localhost:5678/webhook
   N8N_WEBHOOK_SECRET=<same value as the Brandly Webhook Secret credential>
   ```
   Restart `npm run dev` if it doesn't pick up the change.

## Publish request

```json
POST /api/publish
{
  "post": { /* a ScheduledPost from the store */ },
  "mediaUrls": ["https://.../image.jpg"],   // optional, overrides post.mediaUrl; required for Instagram
  "publishAt": "2026-11-20T09:00:00Z",       // optional; future time => Ayrshare schedules it
  "profileKey": "..."                        // optional; Ayrshare Business user profile
}
```

Response: `{ postId, status: "published" | "scheduled" | "partial" | "failed", results: [{ platform, ok, postUrl?, error? }] }`.

## Not covered yet

- Brand and post data still live in the browser (Zustand + localStorage), so n8n can't run
  automation rules on its own schedule. That needs a database (e.g. Supabase) that both sides can read.
- Image hosting: Pollinations links are permanent, but images from the Alibaba backup expire after
  24 hours. Copy those to permanent storage (e.g. Supabase Storage) if the backup gets used.
