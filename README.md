# Draft the Cast

Fantasy leagues for reality TV, starting with Hell's Kitchen Season 25. Friends sign in with Google, draft contestants, guess who goes home each week, and score points from each episode's results.

**Stack:** Next.js on Vercel, Supabase for the database and Google sign-in. No server secrets are needed; every rule is enforced in the database.

## How it works

- **Leagues:** anyone signed in can start a league and share its invite link. The creator is the commissioner.
- **Draft:** "take turns" (snake, each chef once) or "free pick" (chefs can repeat). The database checks turns, so two people can't grab the same chef.
- **Weekly guess:** pick who goes home. Guesses lock automatically at the episode's air time, and other people's guesses stay hidden until then.
- **Results:** each league's commissioner can enter results for their own league from its Results tab. Site-wide results (entered at `/admin`, or synced from `data/`) fill in for any episode a league hasn't entered itself. A league's own entry always wins.
- **Admin view:** site admins see every league and an Admin/Player toggle in the header. Player view shows the site the way everyone else sees it.
- **Scoring:** see `src/lib/scoring.ts` (tested in `scoring.test.ts`).

## One-time setup

### 1. Database (Supabase)
1. Open your Supabase project, then **SQL Editor**, then **New query**.
2. Paste all of `supabase/migrations/20261004000001_schema.sql` and click **Run**.
3. New query again: paste `supabase/migrations/20261004000002_seed_hells_kitchen_25.sql` and click **Run**.
3a. New query again: paste `supabase/migrations/20261005000003_league_results.sql` and click **Run**. This lets each league's commissioner enter results for their own league.
4. Go to **Project Settings**, then **API** (or **Data API**). Copy the **Project URL** and the **anon** (or **publishable**) key.

### 2. Hosting (Vercel)
1. **Add New**, then **Project**, then import `draftthecast/draftthecast`. If it isn't listed, choose to adjust GitHub app permissions and give Vercel access to the `draftthecast` organization.
2. Before deploying, open **Environment Variables** and add:
   - `NEXT_PUBLIC_SUPABASE_URL` = the Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = the anon or publishable key
3. Click **Deploy**.
4. In the project, go to **Settings**, then **Domains**, and add `draftthecast.com` (and `www.draftthecast.com`). Add the DNS records Vercel shows at your domain registrar, and turn off any domain forwarding there.

### 3. Google sign-in
1. In [Google Cloud Console](https://console.cloud.google.com), signed in as draftthecast@gmail.com, create a project called **Draft the Cast**.
2. Open **Google Auth Platform** (or **APIs & Services**, then **OAuth consent screen**):
   - **Branding:** app name "Draft the Cast", support email draftthecast@gmail.com, home page `https://draftthecast.com`, privacy policy `https://draftthecast.com/privacy`, terms `https://draftthecast.com/terms`. Skip the logo for now (adding one triggers a review).
   - **Audience:** External, then **Publish app**.
   - **Clients:** **Create client**, type **Web application**.
     - Authorized JavaScript origins: `https://draftthecast.com`
     - Authorized redirect URIs: `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback` (Supabase shows this exact address on its Google provider page)
   - Copy the **Client ID** and **Client secret**.
3. In Supabase, go to **Authentication**, then **Sign In / Providers**, then **Google**. Turn it on, paste the Client ID and secret, and save.
4. In Supabase, go to **Authentication**, then **URL Configuration**:
   - Site URL: `https://draftthecast.com`
   - Redirect URLs: `https://draftthecast.com/**`, `https://*-draftthecast.vercel.app/**`, `http://localhost:3000/**`

### 4. Make yourself the admin
1. Go to draftthecast.com and sign in with Google once.
2. In the Supabase SQL Editor, run (with your email):
   ```sql
   insert into public.site_admins (user_id)
   select id from auth.users where email = 'you@example.com';
   ```
3. Refresh the site. "Enter results" appears at the top.

### 5. Start your league
Create a league on the home page, copy the invite link from the **Commissioner** tab, and send it to friends. Do a practice pick with one friend, then use **Clear all picks** before the real draft.

## Weekly results (automatic)
1. The day after each episode airs, a scheduled Claude task reads recaps and writes `data/hk25/ep-NN.json` (format and rules in `data/README.md`), then pushes it to `main`.
2. The **Sync results** GitHub Action copies the files into Supabase. Standings update right away.
3. If the elimination can't be confirmed from two sources, the file is saved with `"posted": false`, which doesn't count yet. Fix it by editing the file on GitHub and setting `"posted": true`.

One-time setup for this: in GitHub, open the repo's **Settings**, then **Secrets and variables**, then **Actions**, and add two repository secrets:
- `SUPABASE_URL`: the Project URL
- `SUPABASE_SERVICE_ROLE_KEY`: from Supabase **Project Settings**, then **API Keys**, the `service_role` (or secret) key. Keep this one private.

Then open **Actions**, choose **Sync results**, and click **Run workflow** once to check it works.

The `/admin` page still works for quick fixes, but the files win: the next sync overwrites anything changed there.

## Local development
```bash
cp .env.example .env.local   # fill in the two Supabase values
npm install
npm run dev                  # http://localhost:3000
npm test                     # scoring tests
```

## Adding another show later
Insert a row in `seasons`, its `contestants` and `episodes` (see the Hell's Kitchen seed file). New leagues can pick it from the home page. Team colors and the "kitchen" wording are currently Hell's Kitchen-specific.
