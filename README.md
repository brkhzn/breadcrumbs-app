# 🍞 Breadcrumbs

**Never lose your place again.**

Track your progress in books, TV shows, movies, and video games. Powered by [AT Protocol](https://atproto.com/) — your data lives in YOUR personal data server.

## Features

- 📚 Track books, TV, movies, games, and more
- 🔍 Search autocomplete with cover art (TMDB, Google Books, RAWG)
- 🦋 Sign in with Bluesky — no new account needed
- 📦 Data ownership — your entries stay in your PDS
- ✨ AI-powered "catch me up" summaries (coming soon)
- 📊 Analytics dashboard

## Architecture

```
┌─────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│  AT Protocol    │
│  (Static HTML)  │     │   (Bluesky)     │
│                 │     │                 │
│  Cloudflare     │     │  • Auth         │
│  Pages          │     │  • Data (PDS)   │
└─────────────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐
│   Media APIs    │
│  • TMDB         │
│  • Google Books │
│  • RAWG         │
└─────────────────┘
```

**Why AT Protocol?**
- Your data is stored in YOUR personal data server
- If this app disappears, your data doesn't
- Portable identity — use your existing Bluesky handle
- No database costs for the developer (that's me!)

## Development

### Local Development

Just open `public/index.html` in your browser. No build step needed.

```bash
# Or use a local server
npx serve public
```

### Project Structure

```
breadcrumbs-app/
├── public/
│   ├── index.html      # The entire app (single file)
│   └── _headers        # Security headers for Cloudflare
├── functions/          # Cloudflare Workers (future AI endpoint)
│   └── api/
└── README.md
```

## Deployment

### Cloudflare Pages

1. Push to GitHub
2. Connect repo in Cloudflare Pages dashboard
3. Settings:
   - Build command: (leave empty)
   - Build output directory: `public`
4. Deploy!

### Environment Branches

| Branch | Environment | URL |
|--------|-------------|-----|
| `main` | Production | breadcrumbs.app |
| `staging` | Staging | staging.breadcrumbs.pages.dev |
| `*` | Preview | pr-123.breadcrumbs.pages.dev |

## AT Protocol Lexicon

Breadcrumbs entries are stored as records in the user's PDS:

```json
{
  "$type": "app.breadcrumbs.entry",
  "type": "book",
  "title": "Project Hail Mary",
  "progress": "Page 284",
  "notes": "Rocky is amazing",
  "genre": "Sci-Fi",
  "rating": 5,
  "cover": "https://...",
  "author": "Andy Weir",
  "createdAt": "2025-02-22T19:30:00.000Z"
}
```

Collection: `app.breadcrumbs.entry`

## Roadmap

- [x] AT Protocol authentication
- [x] CRUD operations to PDS
- [x] Media search with cover art
- [x] Analytics dashboard
- [ ] AI-powered summaries (Claude API)
- [ ] Social features (see friends' lists)
- [ ] Custom lexicon registration
- [ ] PWA with offline support

## License

MIT

## Credits

- [AT Protocol](https://atproto.com/) by Bluesky
- [TMDB](https://www.themoviedb.org/) for movie/TV data
- [Google Books API](https://developers.google.com/books) for book data
- [RAWG](https://rawg.io/) for video game data
