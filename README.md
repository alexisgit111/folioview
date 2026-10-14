# FolioView

A browser-based viewer for real estate brochures, design portfolios and meeting presentations. Open a PDF and read it as a **page-turning flipbook**, **page by page** with zoom and thumbnails, or **present it fullscreen**.

**Status: Milestone 1 — browser-only MVP.** PDFs are opened from the user's device and rendered in the browser tab with PDF.js. Nothing is uploaded, stored or tracked, and there is no backend yet.

---

## Quick start

Requires Node.js 20.19+ (22 LTS recommended).

```bash
npm install
npm run dev          # http://localhost:5173
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Type-check and build to `dist/` (static files) |
| `npm run preview` | Serve the production build on :4173 |
| `npm test` | Unit tests (Vitest) |
| `npm run test:e2e` | Builds, then runs Playwright end-to-end tests (desktop + mobile) |
| `npm run test:all` | Both |
| `npm run typecheck` / `npm run lint` | TypeScript / oxlint |
| `npm run fixtures` | Regenerate demo + test PDFs (`pip install reportlab`) |

First Playwright run: `npx playwright install chromium`. In locked-down environments where that download is blocked, point the tests at any Chromium binary instead: `PW_CHROMIUM_PATH=/path/to/chromium npm run test:e2e`.

`dev`, `build` and `preview` first copy PDF.js runtime assets (CMaps, standard fonts, wasm image decoders, ICC profiles) into `public/pdfjs/` so they're served from your own origin — no CDN calls.

### Deploying the MVP

`npm run build` produces a static site in `dist/`. Any static host works. Because routes (`/viewer`, `/present`) are client-side, configure the host to serve `index.html` for unknown paths (SPA fallback). On Apache/Cloudways that is a `.htaccess` rewrite; this is covered properly in Milestone 4.

---

## What's in Milestone 1

- **Dashboard** — drop zone, file picker, three bundled fictional demo documents with live cover thumbnails, and a clear "local-only" status. No pretend saved documents.
- **Opening files** — drag-and-drop anywhere or file picker; validates size (configurable, 100 MB default) and the `%PDF-` byte signature (MIME types are ignored as unreliable); friendly messages for empty, too-large, non-PDF, corrupted and truncated files; password prompt for encrypted PDFs with wrong-password retry; progress bar and cancel. Local files use object URLs that are revoked when replaced or closed.
- **Flipbook** — StPageFlip with realistic soft-page curl, hard covers, a single front cover then two-page spreads, back cover on its own; mouse drag, click, touch swipe, keyboard; switches to a one-page book on narrow screens; live resize.
- **Single page** — fit width, fit page, zoom 25–400% (buttons and `+`/`-`), lazy thumbnail rail, go-to-page, swipe on touch.
- **Presentation** — dark stage, one page at a time, original aspect ratio, Fullscreen API with a full-window fallback where it isn't supported (e.g. iPhone Safari), `→`/`←`, `PageDown`/`PageUp`, `Space`, `Home`/`End`, `F` toggles fullscreen, `Esc` exits back to the viewer on the same page, tap left/right thirds, controls and cursor fade after 2.5 s idle.
- **Accessibility** — labelled controls, visible focus ring, live-region page announcements, native `<dialog>` modals (focus trap + Esc), 44 px touch targets, `prefers-reduced-motion` respected (no curl animation, no fades).
- **States** — empty, loading, error, render failure per page, unsupported browser, app crash boundary, 404.

### Keyboard

| Key | Viewer | Present |
| --- | --- | --- |
| `→` / `PageDown` | Next page / spread | Next slide (`Space` too) |
| `←` / `PageUp` | Previous | Previous |
| `Home` / `End` | First / last | First / last |
| `+` / `-` | Zoom (single-page) | — |
| `F` | — | Toggle fullscreen |
| `Esc` | Close dialogs | End presentation |

Shortcuts are ignored while typing in the page box.

---

## Architecture and key decisions

```
src/
  lib/pdf/
    pdfjs.ts        PDF.js setup (worker, asset URLs) and loadPdf()
    validate.ts     size + %PDF- signature checks before PDF.js sees the file
    errors.ts       maps PDF.js/browser errors to user-facing PdfError kinds
    renderSlot.ts   one canvas per slot; cancels stale renders, swaps when done
    renderImage.ts  page → image URL for the flipbook
    geometry.ts     fit/zoom maths and the canvas pixel budget
    spreads.ts      cover/spread layout + render window
  state/DocumentContext.tsx   the one open document, load state, current page
  components/viewer/          Flipbook, SinglePage, PdfPage
  pages/                      Dashboard, Viewer, Present
```

- **No Zustand.** Shared state is one open document plus the current page; a React context is enough. Page position is shared, so switching Flipbook ↔ Single ↔ Present keeps your place.
- **Rendering.** Canvas backing stores are sized for `devicePixelRatio` and capped at `VITE_MAX_CANVAS_PIXELS`. Each render draws into an off-DOM canvas and swaps in only on success, so the old page stays visible (no flash) and an in-flight render is cancelled as soon as a newer one is requested. Released canvases are shrunk to 0×0 to return memory immediately.
- **Large PDFs.** Thumbnails render only near the visible area and are freed when scrolled away. The flipbook keeps images only within ±4 pages of the reader (configurable); a 120-page test confirms at most 10 are held. Page sizes after page 1 are measured in the background so opening is fast. Destroying a document is deferred until React has unmounted its pages.
- **Flipbook uses `<img>`, not `<canvas>`.** StPageFlip animates soft pages by cloning their DOM node, and a cloned canvas is blank. Pages are rendered to WebP object URLs instead (revoked when released). StPageFlip owns its DOM, so it's created imperatively inside a React-managed host rather than reconciled by React. Turns requested mid-animation are queued rather than dropped.
- **Security posture.** PDF.js runs in a worker; XFA is off and PDF JavaScript is never executed (no scripting sandbox). All assets are self-hosted. Passwords are only passed to PDF.js in memory.
- **shadcn/ui not used yet.** The MVP needs only a button, an icon button and a modal; these are small local components, and the modal uses the native `<dialog>` element. shadcn can be adopted in Milestone 2 when forms and tables arrive.
- **Mixed page sizes.** Single-page and Present size each page individually. The flipbook sizes the book from page 1; other pages are letterboxed inside it (`object-fit: contain`) — a book can only have one page size.

## Testing

- **Unit (Vitest, 44 tests):** validation and signature search, error mapping, fit/zoom maths and pixel budget, cover/spread pairing for 1/2/3/4/12 pages, render window bounds, `RenderSlot` cancellation/swap/release, browser feature detection, and every fixture PDF loaded through real PDF.js (page counts, A4 portrait/landscape sizes, password needed/wrong/right, corrupted).
- **End-to-end (Playwright, 47 tests: desktop 1440×900 + Pixel 7):** dashboard and empty states, unsupported browser, focus ring; file picker and drag-and-drop; non-PDF, corrupted, truncated and password-protected files; object-URL revocation; 1/2/3/120-page and landscape documents; flipbook keyboard, buttons, go-to-page, mouse drag, click, resize/orientation, reduced motion; single-page DPR sharpness, zoom/fit, thumbnails, rapid-navigation render cancellation; presentation fullscreen, keys, click zones, idle fade, Esc exit, no-Fullscreen-API fallback; mobile layout, real CDP touch swipes in single-page and flipbook, tap-to-advance.

Fixtures live in `tests/fixtures/` and are generated by `scripts/generate_pdfs.py`.

## Known limitations (Milestone 1)

- Documents are not persisted — reload clears them (by design until Milestone 2).
- No text selection, search, links or annotation layer; pages are rendered as images.
- The flipbook uses one page size for the whole book (see above).
- iPhone Safari has no element Fullscreen API; Present uses a full-window view there.
- Fonts not embedded in a PDF fall back to PDF.js standard fonts, which may differ slightly from the original.
- Tested in Chromium (desktop and mobile emulation). Firefox and real iOS/Android devices should be checked by hand before wider use — see ROADMAP.

See [ROADMAP.md](./ROADMAP.md) for what comes next.
