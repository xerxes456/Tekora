# Tekora — Maintenance Management System

> A Computerized Maintenance Management System (CMMS) built with vanilla JS, Supabase, and hosted on GitHub Pages.

---

## Live URL

Once deployed, your site will be available at:

```
https://<your-github-username>.github.io/tekora/
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, Vanilla JavaScript (ES2020) |
| Database & Auth | Supabase (PostgreSQL + Auth) |
| Hosting | GitHub Pages |
| Icons | SVG Sprite (`images/icons.svg`) |

---

## Project Structure

```
tekora/
├── index.html              ← Single entry point
├── .nojekyll               ← Disables Jekyll on GitHub Pages
├── css/
│   └── tekora.css          ← All styles (5 themes + responsive)
├── js/
│   ├── supabase.config.js  ← ✏️  Edit this: add your Supabase URL & key
│   ├── app.js              ← Shared core (state, helpers, nav, modal)
│   ├── auth.js             ← Auth logic (login, register, logout)
│   └── pages/              ← One JS file per page
│       ├── dashboard.js
│       ├── requests.js
│       ├── equipment.js
│       ├── pms.js
│       ├── preferences.js
│       ├── facilities.js
│       ├── activities.js
│       ├── pms-admin.js
│       ├── users.js
│       ├── company.js
│       └── reports.js
├── pages/                  ← HTML partials (one per page, for reference)
├── images/                 ← SVG logo, favicon, icon sprite
└── supabase/
    └── schema.sql          ← Run once in Supabase SQL Editor
```

---

## Setup Guide

### 1 — Supabase

1. Create a free project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** → paste and run the contents of `supabase/schema.sql`
3. Go to **Authentication → Users → Add user**:
   - Email: `Admin@tekora.example`
   - Password: `Admin`
   - Copy the UUID shown
4. Back in SQL Editor, run:
   ```sql
   UPDATE users SET is_admin = true, role = 'admin'
   WHERE email = 'Admin@tekora.example';
   ```
   (Or update the `INSERT` at the bottom of `schema.sql` with the UUID and re-run it)
5. Go to **Project Settings → API** and copy:
   - **Project URL** (looks like `https://xxxx.supabase.co`)
   - **anon / public** key

### 2 — Configure `js/supabase.config.js`

Open the file and replace the two placeholder values:

```js
const SUPABASE_URL  = "https://your-project.supabase.co";   // ← your URL
const SUPABASE_ANON = "your-anon-public-key";               // ← your key
```

### 3 — Deploy to GitHub Pages

**Option A — GitHub Web UI (no terminal required)**

1. Go to [github.com](https://github.com) → sign in → click **+** → **New repository**
2. Name it `tekora` → set to **Public** → click **Create repository**
3. Click **uploading an existing file** (or drag-and-drop)
4. Upload **all files and folders** from the `tekora/` directory
   - Make sure `index.html` is at the **root** of the repository (not inside a subfolder)
5. Click **Commit changes**
6. Go to **Settings → Pages**
7. Under **Source** → select branch **main** → folder **/ (root)** → click **Save**
8. Wait ~60 seconds → your live URL appears at the top of the Pages section

**Option B — Git CLI**

```bash
# Clone the new empty repo you created on GitHub
git clone https://github.com/<your-username>/tekora.git
cd tekora

# Copy all Tekora project files into the cloned folder
cp -r /path/to/tekora-project/* .

# Commit and push
git add .
git commit -m "Initial deploy: Tekora CMMS"
git push origin main

# Then enable Pages in GitHub Settings → Pages → Source: main / (root)
```

**Option C — GitHub CLI**

```bash
cd /path/to/tekora-project
gh repo create tekora --public --source=. --remote=origin --push
# Then enable Pages in repo Settings → Pages
```

---

## Default Login

| Field | Value |
|---|---|
| Email | `Admin@tekora.example` |
| Password | `Admin` |

**Change these immediately after first login** via Preferences → Access & Security.

---

## Themes

Five built-in colour themes selectable from Preferences:

| Name | Style |
|---|---|
| Midnight | Dark, teal accent |
| Arctic | Dark, blue accent |
| Warm Slate | Dark, amber accent |
| Cloud | Light, clean |
| Forest | Light, green |

---

## Important Notes

- **Must be served over HTTP/HTTPS** — Supabase JS client does not work from `file://`
- GitHub Pages provides free HTTPS automatically — no configuration needed
- The `supabase/schema.sql` file is for setup only and is not loaded by the app
- `.nojekyll` at the root tells GitHub Pages to skip Jekyll processing

---

## License

MIT — free to use and modify.
