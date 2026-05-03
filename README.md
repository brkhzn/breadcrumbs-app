# Breadcrumbs

A personal log for keeping track of where you left off in books, shows, films, games, and podcasts. Your records live on your own [AT Protocol](https://atproto.com/) Personal Data Server, the same kind of server that holds Bluesky posts. Sign in with your Bluesky handle and an app password.

## A note on how this was built

Most of this codebase was written by [Claude Code](https://claude.com/claude-code), Anthropic's CLI coding agent, with direction and review from a human (the repo owner). That includes the architecture, the UI, the AT Protocol integration, and most of the prose in the app. The README you're reading right now was also written that way. We're flagging this so nobody has to guess.

What that means in practice:

- The code is real, runs in production, and has been reviewed before each commit.
- Some patterns might be more verbose than a human-only codebase. We've kept them when they were clear, refactored when they got in the way.
- If you find a bug or something that looks wrong, please open an issue. The whole point of having a bug report flow is to catch what review missed.

## What it does

- Logs progress on books, shows, films, games, and podcasts with the right fields for each: page numbers, season/episode, hours played, completion percent, time-into-episode for podcasts.
- Stores every entry as a typed record on your PDS. There is no Breadcrumbs database. We don't keep a copy.
- Searches metadata APIs to fill in cover art, descriptions, and authors so you don't type everything by hand.
- Groups your timeline by day so it reads like a journal, not a feed.
- Charts a 90-day daily heatmap of your activity, broken out by media type.
- Lets you build lists (winter reads, rewatch queue, whatever) and view them as stacked-cover collections.
- Ships with a Demo Mode that uses local storage only, in case you want to try the UI without signing in.

## What it doesn't do

- No analytics, no tracking pixels, no third-party trackers.
- No advertising. No data resale.
- No accounts to create. The Bluesky/AT Protocol identity you already have is the account.
- No private data store. We don't run a database.

## A note on visibility

Records on AT Protocol are public by design. Anyone who knows your handle can read your Breadcrumbs entries through tools like [atproto-browser.dev](https://atproto-browser.dev) or any other AT Protocol client. If you want a private reading log, this isn't the right tool. The in-app [Privacy](public/index.html) screen has the longer version of this.

## Architecture

```
┌─────────────────────────┐     ┌──────────────────────┐
│  Static frontend        │────▶│  AT Protocol PDS     │
│  HTML + CSS + JS        │     │  (e.g. bsky.social)  │
│  Cloudflare Pages       │     │                      │
└─────────────────────────┘     │  • createSession     │
              │                 │  • createRecord      │
              ▼                 │  • listRecords       │
┌─────────────────────────┐     └──────────────────────┘
│  Pages Functions        │
│  Media metadata proxies │
│  • TMDB (films, shows)  │
│  • RAWG (games)         │
│  • iTunes (podcasts)    │
│  • Open Library (books) │
└─────────────────────────┘
```

There is no build step. The frontend is hand-written HTML, CSS, and one `app.js` file. Pages Functions are used only to keep third-party API keys out of the browser.

## Project layout

```
breadcrumbs-app/
├── public/
│   ├── index.html          # App shell + every screen
│   ├── app.js              # All app logic
│   ├── breadcrumbs.css     # Design tokens + every component
│   ├── _headers            # Cloudflare security headers
│   ├── manifest.json       # PWA manifest
│   └── icons/              # PWA icons
├── functions/
│   └── api/
│       ├── tmdb.js         # TMDB proxy (films, shows)
│       ├── rawg.js         # RAWG search
│       └── rawg-detail.js  # RAWG detail (descriptions)
├── lexicons/               # AT Protocol record schemas
└── README.md
```

## Running it locally

You need Node only because of `wrangler`. There is no npm install step beyond that.

```bash
# Run with Cloudflare Pages Dev (needed for media search)
npx wrangler pages dev public
```

Then open `http://localhost:8788`.

If you want to skip the dev server, you can also open `public/index.html` directly. Search will fail because the API proxies aren't reachable, but everything else works against your real PDS.

## Deploying to Cloudflare Pages

1. Push to GitHub.
2. Connect the repo in the Cloudflare Pages dashboard.
3. Build settings: leave the build command empty. Set the build output directory to `public`.
4. Add API keys as environment variables on the Pages project:
   - `TMDB_API_KEY` from [themoviedb.org](https://www.themoviedb.org/settings/api)
   - `RAWG_API_KEY` from [rawg.io/apidocs](https://rawg.io/apidocs)

For the bug-report feature you'll also need:

- `GITHUB_TOKEN`: a fine-scoped personal access token with `Issues: Write` on this repo. Used by `functions/api/report-bug.js` to file user-submitted issues.

`main` deploys to production. Other branches get preview URLs.

## AT Protocol records

Every entry is stored as a typed record on the user's PDS, one collection per media type:

| Media type | Collection                |
|------------|---------------------------|
| Book       | `app.breadcrumbs.book`    |
| Show       | `app.breadcrumbs.show`    |
| Film       | `app.breadcrumbs.movie`   |
| Game       | `app.breadcrumbs.game`    |
| Podcast    | `app.breadcrumbs.podcast` |

Lists are stored under `app.breadcrumbs.list`. Full schemas are in [`/lexicons`](./lexicons).

Example book record:

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
  "rating": 5,
  "genres": ["Sci-Fi"],
  "notes": "Rocky is the best first contact I've read.",
  "coverUrl": "https://covers.openlibrary.org/...",
  "createdAt": "2026-04-01T09:00:00.000Z"
}
```

## Reporting a bug

The app has a built-in "Report a bug" button in Settings. It files a tagged issue on this repo via a Cloudflare Function so we can track and triage it. Reports are public (since this repo is public), so don't include personal info or anything you'd rather keep private.

You can also open an issue directly on [GitHub Issues](https://github.com/brkhzn/breadcrumbs-app/issues) if you'd rather skip the in-app form.

## Credits

- [AT Protocol](https://atproto.com/) by Bluesky
- [TMDB](https://www.themoviedb.org/) for film and TV metadata
- [Open Library](https://openlibrary.org/dev/docs/api) and [Google Books](https://developers.google.com/books) for book metadata
- [RAWG](https://rawg.io/) for game metadata
- [iTunes Search API](https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/) for podcast metadata
- Most of the code was written by [Claude Code](https://claude.com/claude-code)

## License

MIT.
