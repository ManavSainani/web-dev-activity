# Supabase access-key and recording setup

The site is public, but recording requires a database-issued one-time key. Keys are stored as SHA-256 hashes, expire after 24 hours by default, and are consumed atomically on first use. A successful key grants a signed, HTTP-only recording session for 30 minutes. Uploads use short-lived, single-object Supabase signed upload URLs; the service key stays on the server.

## 1. Set up the database

Run the full contents of [`supabase/setup.sql`](supabase/setup.sql) in the Supabase SQL Editor. It creates the private token table and functions, a private `recordings` Storage bucket, and a server-only `recording_uploads` metadata table.

To issue a key, run this in the SQL Editor:

```sql
select private.issue_access_token(interval '24 hours');
```

Copy the returned value and give it to one researcher. The database stores only its hash, so the raw key cannot be retrieved later. Run the query again for another key. You can set another lifetime, up to 30 days, by changing the interval.

## 2. Configure environment variables

Copy `.env.example` to `.env.local` for local development and fill in these values:

- `NEXT_PUBLIC_SUPABASE_URL`: project URL.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: publishable key used by the browser only for signed uploads.
- `SUPABASE_SECRET_KEY`: server-only `sb_secret_...` key. A legacy service-role key is also accepted as `SUPABASE_SERVICE_ROLE_KEY`.
- `ACCESS_SESSION_SECRET`: random server-only signing secret. Generate one with `openssl rand -base64 32`.
- `TOKEN_ADMIN_KEY`: a second, separate random secret for the token-creation page. Generate it with another `openssl rand -base64 32` command.

Set the same four variables in Vercel for Production and Preview, then redeploy. Do not put the secret key or session secret in any `NEXT_PUBLIC_` variable or commit `.env.local`.

## 3. Use the public recorder

Open `/admin` on your deployed site to create keys. Enter `TOKEN_ADMIN_KEY`, choose an expiry, then copy the one-time key shown. The key-creation page calls a server-only database function; the raw key is displayed once and the database stores only its hash.

The researcher pastes the one-time key into the public site. On redemption, the server asks Postgres to consume it, then opens a 30-minute session. The browser can record only during that session. Saving sends the file directly to the private bucket using a short-lived signed upload token, then the server records its title, type, duration, and size.

The one-time key is consumed when access is granted; the researcher does not need another key for every recording during the 30-minute session. Access ends automatically after 30 minutes or when **End access** is selected.
