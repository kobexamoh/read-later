# Read Later

Paste your links. Get a categorized digest. Read with intention.

A personal tool that takes a week's worth of saved links, enriches them with AI-generated descriptions and topic labels, and produces a structured weekly reading digest — filtered by what you actually care about.

## Stack

- **Next.js 16** (App Router, JavaScript)
- **Supabase** (Postgres + Auth + Row-Level Security)
- **Google Gemini API** (free tier — `gemini-2.0-flash`)
- **Tailwind CSS v4** with typography plugin
- **Vercel** for deployment

## Local Development

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project (free tier works)
- A [Google Gemini API key](https://aistudio.google.com/apikey) (free tier)

### 1. Install dependencies

```sh
npm install
```

### 2. Set up environment variables

Copy the example and fill in your keys:

```sh
cp .env.local.example .env.local
```

You need three values:
- `NEXT_PUBLIC_SUPABASE_URL` — your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — your Supabase anon (public) key
- `GEMINI_API_KEY` — your Google Gemini API key

### 3. Set up the database

Go to your Supabase project's **SQL Editor** and run the contents of `supabase/schema.sql`. This creates all tables and RLS policies.

### 4. Configure Supabase Auth

In your Supabase dashboard:

1. Go to **Authentication → Providers** and make sure **Email** is enabled.
2. For local dev, go to **Authentication → URL Configuration** and set:
   - **Site URL**: `http://localhost:3000`
   - **Redirect URLs**: `http://localhost:3000/auth/callback`
3. Optionally disable "Confirm email" under **Authentication → Settings** for faster local testing (re-enable for production).

### 5. Run the dev server

```sh
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## How It Works

1. **Sign up** — create an account with email/password.
2. **Settings** — describe your interests (free text) and pick strict or relaxed mode.
3. **Paste** — dump URLs (raw or markdown-style) into the text box. The app extracts and saves them.
4. **Digest** — hit "Generate digest." The app:
   - Fetches each page and extracts title + text snippet
   - Calls Gemini to generate a 1–2 sentence description and assign topic labels
   - Groups links by topic, applies strict/relaxed filtering
   - Produces a markdown digest you can copy into Notion, Obsidian, email, etc.

### Modes

- **Strict**: only links matching your declared interests appear in the digest. Filtered links are counted but hidden.
- **Relaxed**: all links appear, organized by topic. You see everything, just structured.

### Topic Categories

`politics` · `pop_culture` · `tech` · `career` · `long_read` · `brain_rot` · `other`

## Project Structure

```
app/
├── src/
│   ├── app/
│   │   ├── (app)/              # Authenticated routes (paste, digest, settings)
│   │   ├── api/
│   │   │   ├── enrich/         # POST — enrich pending links via Gemini
│   │   │   └── digest/         # POST — generate weekly digest
│   │   ├── auth/callback/      # Supabase auth callback
│   │   ├── login/
│   │   ├── signup/
│   │   ├── actions.js          # Server actions (login, signup, logout)
│   │   ├── layout.js           # Root layout
│   │   └── page.js             # Landing page
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.js       # Browser Supabase client
│   │   │   └── server.js       # Server Supabase client
│   │   ├── gemini.js           # Gemini API wrapper
│   │   └── url-parser.js       # URL extraction + deduplication
│   └── proxy.js                # Auth session refresh (Next.js 16 proxy)
├── supabase/
│   └── schema.sql              # DB schema + RLS policies
├── .env.local.example
└── package.json
```

## Deploying to Vercel

### 1. Push to GitHub

```sh
git add .
git commit -m "Initial MVP"
git push origin main
```

### 2. Import in Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and import your GitHub repo.
2. Set the **Root Directory** to `app` (since the Next.js project lives in the `app/` subdirectory).
3. Vercel auto-detects Next.js — no build config changes needed.

### 3. Add environment variables

In the Vercel project settings → **Environment Variables**, add:

- `NEXT_PUBLIC_SUPABASE_URL` — your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — your Supabase anon key
- `GEMINI_API_KEY` — your Gemini API key

### 4. Update Supabase redirect URLs

In your Supabase dashboard → **Authentication → URL Configuration**:

- **Site URL**: `https://your-app.vercel.app`
- **Redirect URLs**: add `https://your-app.vercel.app/auth/callback`

Keep the localhost entries for local dev.

### 5. Deploy

Vercel deploys automatically on push. Your app will be live at `https://your-app.vercel.app`.

## Deploying Supabase (Production Checklist)

Your Supabase free-tier project is production-ready for personal use. A few things to verify:

1. **RLS is enabled** on all tables (`user_preferences`, `links`, `digests`, `digest_links`) — the schema.sql handles this.
2. **Email confirmation is enabled** in Authentication → Settings (turn it back on if you disabled it for local dev).
3. **API keys are not committed** — `.env.local` is gitignored. Only add keys via Vercel's environment variable UI.
4. **Supabase anon key** is safe to expose client-side (it's rate-limited and scoped by RLS). The `GEMINI_API_KEY` is server-only and never reaches the browser.

## Future (Post-MVP)

- Twitter bookmark integration
- Scheduled digest generation (cron)
- TikTok / audio-to-text
- Knowledge graph views
- Browser extension
