# FolioView roadmap

## ✅ Milestone 1 — browser-only MVP (done)

Runs locally with no server. Open a real multi-page PDF; flipbook with page turning; single-page with zoom, fit modes and thumbnails; fullscreen presentation; keyboard and touch navigation; mobile layout; corrupted, truncated, non-PDF and password-protected file handling. 44 unit + 47 end-to-end tests passing; production build passing.

Before relying on it in meetings, also check by hand:
- Firefox and Safari desktop
- A real iPhone (Safari) and Android phone/tablet, including rotation
- A large real brochure (50–200 MB, image-heavy) on a mid-range laptop

## ⏳ Milestone 2 — authenticated document library (needs approval)

Not started. Proposed design:

- **API:** Node.js + Express if the Cloudways plan supports persistent Node processes; otherwise a Laravel API (Cloudways' native PHP stack).
- **Database:** MySQL, its own database and least-privilege user, schema migrations.
- **Entities:** User, Workspace, Document, DocumentVersion, Collection, ShareLink, AuditEvent. MySQL holds metadata and storage paths, never PDF bytes.
- **Storage:** private directory outside the web root behind a storage interface, so S3-compatible storage can be swapped in later.
- **Auth:** server-side sessions in HttpOnly, Secure, SameSite cookies; roles admin / editor / viewer; CSRF protection on state-changing requests.
- **Uploads:** size limits, `%PDF-` signature check server-side, safe generated filenames, server-side thumbnail generation, delete with retention rules.
- **Front end:** `/library`, `/documents/:id`, `/settings`; the existing viewer loads PDFs from an authorised endpoint instead of object URLs.

Acceptance: reliable upload/storage/metadata/thumbnails/delete, and tests proving users can't reach other workspaces' documents or admin actions.

## Milestone 3 — sharing

Read-only share links (`/share/:token`) with high-entropy random tokens, optional expiry and password, explicit public/private visibility, revocation, rate limits; PDF bytes and previews served only after authorisation (no guessable URLs); QR codes; real-device mobile testing.

## Milestone 4 — production on Cloudways

HTTPS, environment variables, database migrations, backups, monitoring, security headers (CSP, HSTS), SPA fallback, performance checks, and a deployment checklist. No production infrastructure, domains or DNS will be touched without explicit approval.

## Later (only once the core workflow is reliable)

Branding per workspace, speaker notes, view analytics (first-party only — no confidential brochure or vendor data sent to third-party analytics), text search/selection layer, offline caching.
