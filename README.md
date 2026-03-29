# Style-It 👗

A digital wardrobe app — upload clothing photos, remove backgrounds in-browser, and build layered outfits.

## Features
- **Background removal** — Runs entirely in the browser (no API key needed)
- **Wardrobe management** — Upload, categorize, and delete clothing items
- **Outfit builder** — Layer items on a canvas, drag to reposition, resize, and reorder layers
- **Saved outfits** — Save and reload outfit compositions
- **Supabase backend** — Images stored in Supabase Storage, data in Postgres

## Setup

### 1. Supabase
1. Create a free project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run `supabase/schema.sql`
3. Go to **Storage → New Bucket**: create `wardrobe-images` with **Public** enabled
4. Copy your **Project URL** and **anon/public key** from Settings → API

### 2. Configure
Open `js/config.js` and fill in:
```js
const SUPABASE_URL = 'https://xxxx.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key-here';
```

### 3. Local preview
Just open `index.html` in your browser.  
> Note: Background removal downloads a ~40MB WASM model on first use.

### 4. Deploy to GitHub Pages
1. Push to a GitHub repo
2. Go to repo **Settings → Pages → Source → GitHub Actions**
3. Push to `main` — the workflow in `.github/workflows/deploy.yml` auto-deploys

## Project Structure
```
├── index.html              # Single-page app
├── css/main.css            # Styles
├── js/
│   ├── config.js           # ← Fill in Supabase credentials here
│   ├── supabase-client.js  # DB client
│   ├── wardrobe.js         # Upload, fetch, delete wardrobe items
│   ├── outfit-builder.js   # Layer canvas interactions
│   ├── outfits.js          # Saved outfits CRUD
│   └── app.js              # View router & event wiring
├── supabase/schema.sql     # Database setup
└── .github/workflows/
    └── deploy.yml          # GitHub Pages CI/CD
```
