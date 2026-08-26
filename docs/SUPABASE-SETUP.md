# Give ZIU Connect a shared database

Right now every person gets their own private copy of the board. After this,
all 7 of you share one — and changes appear on each other's screens live.

About 15 minutes. Free. No credit card.

---

## Step 1 — Create the project

1. Go to **https://supabase.com** and sign up (GitHub or email).
2. Click **New project**.
3. Fill in:
   - **Name:** `ziu-connect`
   - **Database Password:** click Generate, then save it in your password manager.
     You won't need it for this setup, but you can't get it back later.
   - **Region:** pick the one nearest your team — Mumbai or Singapore for India.
4. Click **Create new project** and wait a minute or two while it builds.

---

## Step 2 — Create the tables

1. In the left sidebar click **SQL Editor**.
2. Click **New query**.
3. Open `supabase-schema.sql`, copy the whole file, paste it in.
4. Click **Run** (or Ctrl+Enter).

You should see *Success. No rows returned*. That's what success looks like here.

To check it worked, click **Table Editor** in the sidebar — you'll see `tasks`
with your 8 tasks in it, and `people` with the 7 names.

Running the file twice is safe; it won't duplicate anything.

---

## Step 3 — Copy your two keys

1. Sidebar → **Settings** (gear icon) → **API Keys**.
2. Copy the **Project URL** — looks like `https://abcdefgh.supabase.co`
3. Copy the **Publishable key** — a long string starting with `sb_publishable_`

   If your project is older and shows **anon / public** instead, that key works too.

**Never copy the secret key** (`sb_secret_...` or `service_role`). That one bypasses
all the rules and must never go near a browser.

---

## Step 4 — Tell the app where the database is

Unzip `ZIU-Connect-netlify-drop.zip`. Inside is a small file called **`config.js`**.
Open it in Notepad and paste your two values between the quotes:

```js
window.ZIU_CONFIG = {
  supabaseUrl: "https://abcdefgh.supabase.co",
  supabaseKey: "sb_publishable_your_key_here",
};
```

Save it. Re-zip the folder — select `index.html`, `config.js`, `_redirects` and the
`assets` folder, right-click → Send to → Compressed (zipped) folder.

> Zip the **files**, not the folder containing them. Netlify wants `index.html`
> at the top of the zip.

---

## Step 5 — Deploy

Drag your new zip onto **https://app.netlify.com/drop** (or the Deploys tab of your
existing site).

Open the site. Top-right, next to the clock, you should see a green **Live** chip.
That means it's talking to the database.

| Chip | Meaning |
|---|---|
| **Live** (green) | Connected. Everyone shares one board. |
| **Connecting** (amber) | Still reaching the database — should settle in a second. |
| **This browser** (grey) | No credentials found. Check `config.js` made it into the zip. |
| **No database** (red) | Credentials found but wrong. Recheck the URL and key. |

---

## Step 6 — Try it

Open the site on your laptop and your phone at the same time. Sign in as different
people. Move a task on one — watch it move on the other within a second or two.

That's the whole thing working.

---

## What lives in the database now

Tasks and their stages, comments, attachments, links, remarks, the 7 people, team
chat, notifications, the email log, and your Groq and EmailJS keys.

Two things stay local on purpose: **light/dark theme** (a personal preference) and
which name you last signed in as.

**Your EmailJS keys are now shared too.** Set them once in Settings and progress
emails work for everyone, not just whoever pasted them.

---

## Please read this part

**Anyone with your site URL can read and change everything.**

You chose the name-picker sign-in, so there are no accounts and no passwords. The
database can't tell Krunal from a stranger, so it has to accept changes from
anybody who asks. Someone who finds the link can click "Krunal Rajput" and delete
every task.

That's a reasonable trade for an internal tool on a link you don't publicise. Just
know it's the deal you've made:

- Don't post the URL publicly or put it anywhere indexed by Google.
- The view-only restriction on Vijesh, Ujay and Jigar is enforced by the app, not
  by the database. Someone technical could get around it.

When you want this properly locked down, switching to email sign-in is a contained
change: the tables stay exactly as they are, you swap the security rules from
"anyone" to "signed-in people", and add a login screen. Nothing gets rebuilt.

---

## If something goes wrong

**Chip says "This browser"** — `config.js` isn't being found. Open your live site,
add `/config.js` to the URL, press Enter. You should see your keys. If you get a
404, the file didn't make it into the zip.

**Chip says "No database"** — the URL or key is wrong. Watch for a trailing slash on
the URL, or a key that got cut off when copying.

**Board is empty** — Step 2 didn't run. Check Table Editor for a `tasks` table.

**Changes don't appear on the other device** — realtime isn't on for those tables.
In Supabase go to **Database → Publications → supabase_realtime** and make sure
`tasks`, `notifications`, `chat_messages`, `people` are toggled on. The schema file
does this, but it's worth checking.

**Everything looks broken** — press F12 in Chrome, click Console, and look for lines
starting with `[ziu]`. Send me what they say.

Worth knowing: if the database is unreachable the app doesn't crash. It logs a
warning, falls back to the built-in sample data, and stays usable.

---

## Free tier

Supabase's free tier is far more than this app needs — it's built for far bigger
workloads than 7 people and a handful of tasks. The one thing to watch: free
projects pause after a stretch of no activity, and you restart them from the
dashboard in a click. A board people open most days won't hit that.
