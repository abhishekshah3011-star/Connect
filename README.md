# ZIU Connect

Task and workflow portal — React + Vite, backed by Supabase.

## Deploy on Vercel

Push this to GitHub and import the repo at vercel.com/new. `vercel.json`
supplies every setting, so accept the defaults and click Deploy.

Nothing needs to go in Vercel's Environment Variables: the Supabase project
URL and publishable key live in `public/config.js`, which ships with the site
and can be edited afterwards without rebuilding.

## Run locally

    npm install
    npm run dev

## Database

Run each of these once in the Supabase SQL Editor. All are safe to re-run.

| File | Creates |
|---|---|
| `sql/supabase-schema.sql` | Core tables, the 7 people, 8 seed tasks, policies, realtime |
| `sql/storage-setup.sql` | The public `ziu-files` bucket for attachments |
| `sql/requirements-setup.sql` | The `requirements` table fed by the intake form |

Guides are in `docs/`.

## Layout

    src/App.jsx      the whole UI
    src/db.js        every Supabase call
    src/scoring.js   weighted priority scoring
    public/config.js Supabase settings, editable after deploy

## A note on access

There are no accounts — you pick a name to sign in. Role limits are enforced in
the UI, not the database, so anyone with the URL can act as anyone. Fine for an
internal tool on an unlisted link; keep the repo private and don't publish the
URL.
