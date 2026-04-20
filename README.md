# Breadcrumbs

**Never lose your place again.**

Breadcrumbs is a personal media log for people who never want to lose their place. Track where you left off in books, shows, films, games, and podcasts — then pick up right where you stopped.

Built on [AT Protocol](https://atproto.com/), every entry lives in your own Personal Data Server. Your data is yours to export, move, or delete at any time. No lock-in.

---

## Features

- **Progress tracking** — log exactly where you left off, with type-specific fields (page number, season/episode, hours played, etc.)
- **History log** — every progress update is recorded with an optional note, building a timeline of your journey through a book or series
- **Lists** — curate custom collections (winter reads, rewatch queue, anything) with stacked cover art
- **Media search** — autocomplete with cover art via TMDB, Google Books, OpenLibrary, and RAWG
- **Sign in with Bluesky** — no new account needed; uses your existing Bluesky handle and app password
- **Demo mode** — try the full app without signing in, data stored locally
- **Analytics** — reading/watching/playing stats with a per-category heat map
- **Theming** — four palettes (Forest, Ember, Ocean, Ink) × dark/light/system mode + custom accent color
- **Responsive** — mobile-first with a two-column desktop layout, centered modals, and a sidebar of in-progress entries
- **Data ownership** — export everything as JSON anytime; your records stay in your PDS even if this app disappears

---

## Architecture

```
┌──────────────────────┐     ┌─────────────────────┐
│  Frontend            │────▶│  AT Protocol (PDS)  │
│  HTML + CSS + JS     │     │                     │
│  (static, no build)  │     │  • Auth             │
│  Cloudflare Pages    │     │  • Entries          │
└──────────────────────┘     │  • Lists            │
           │                 └─────────────────────┘
           ▼
┌──────────────────────┐
│  Media Search APIs   │
│  (proxied via CF     │
│   Pages Functions)   │
│  • TMDB              │
│  • Google Books      │
│  • OpenLibrary       │
│  • RAWG              │
└──────────────────────┘
```

**Why AT Protocol?**
- Your data lives in your own Personal Data Server — not our database
- If this app ever shuts down, your records stay intact
- Portable identity: use your existing Bluesky handle
- Export or migrate to any compatible app at any time

---

## Project Structure

```
breadcrumbs-app/
├── public/
│   ├── index.html          # App shell + all static HTML
│   ├── app.js              # All app logic (~1800 lines)
│   ├── breadcrumbs.css     # Design system + component styles
│   └── _headers            # Cloudflare security headers
├── functions/
│   └── api/
│       ├── tmdb.js         # TMDB proxy (movies + shows)
│       ├── books.js        # Google Books proxy
│       └── rawg.js         # RAWG proxy (games)
├── lexicons/               # ATProto lexicon definitions
└── README.md
```

---

## Local Development

No build step needed.

```bash
# Option 1: open directly
open public/index.html

# Option 2: local server with Cloudflare Workers (needed for media search)
npx wrangler pages dev public
```

---

## Deployment

### Cloudflare Pages

1. Push to GitHub
2. Connect the repo in the Cloudflare Pages dashboard
3. Settings:
   - Build command: *(leave empty)*
   - Build output directory: `public`
4. Add API keys as environment variables:
   - `TMDB_API_KEY` — [themoviedb.org](https://www.themoviedb.org/settings/api)
   - `RAWG_API_KEY` — [rawg.io/apidocs](https://rawg.io/apidocs)
5. Deploy

| Branch | Environment |
|--------|-------------|
| `main` | Production  |
| `feat/*` | Preview   |

---

## AT Protocol Lexicon

Entries are stored as typed records in the user's PDS, one collection per media type:

| Media type | Collection |
|------------|------------|
| Book       | `app.breadcrumbs.book` |
| Show       | `app.breadcrumbs.show` |
| Movie      | `app.breadcrumbs.movie` |
| Game       | `app.breadcrumbs.game` |
| Podcast    | `app.breadcrumbs.podcast` |

**Example book record:**
```json
{
  "$type": "app.breadcrumbs.book",
  "title": "Project Hail Mary",
  "authors": ["Andy Weir"],
  "status": "app.breadcrumbs.defs#inProgress",
  "progress": {
    "currentPage": 284,
    "totalPages": 476,
    "updatedAt": "2026-04-18T14:00:00.000Z"
  },
  "history": [
    { "ts": "2026-04-10T10:00:00.000Z", "progress": { "currentPage": 120 }, "note": "Can't put it down" },
    { "ts": "2026-04-18T14:00:00.000Z", "progress": { "currentPage": 284 } }
  ],
  "notes": "Rocky is the best first contact I've ever read.",
  "rating": 5,
  "genres": ["Sci-Fi"],
  "coverUrl": "https://covers.openlibrary.org/...",
  "createdAt": "2026-04-01T09:00:00.000Z"
}
```

Lists are stored under `app.breadcrumbs.list`.

Full lexicon definitions are in [`/lexicons`](./lexicons).

---

## Roadmap

- [x] AT Protocol authentication (Bluesky sign-in)
- [x] CRUD operations to PDS with per-type collections
- [x] Media search with cover art
- [x] Progress tracking with type-specific fields
- [x] Progress history log with notes
- [x] Entry detail panel with history timeline
- [x] Lists (create, edit, curate entries)
- [x] Analytics + heat map
- [x] Theming: 4 palettes × dark/light/system
- [x] Responsive desktop layout + centered modals
- [x] Demo mode (no sign-in required)
- [ ] Podcast search (Podcast Index API)
- [ ] Social features — see what friends are reading
- [ ] Public profiles
- [ ] PWA / offline support

---

## Credits

- [AT Protocol](https://atproto.com/) by Bluesky
- [TMDB](https://www.themoviedb.org/) for movie and TV data
- [Google Books](https://developers.google.com/books) + [OpenLibrary](https://openlibrary.org/dev/docs/api) for book data
- [RAWG](https://rawg.io/) for game data

---

MIT License
