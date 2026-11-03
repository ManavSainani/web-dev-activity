# Supabase setup

The app saves each recording to a private Storage bucket and writes its title, owner, format, and duration to a `recordings` table. Users sign in with a department email magic link. The app does not use a service-role key.

## 1. Configure Supabase

1. In Supabase, open **SQL Editor**, paste in [`supabase/setup.sql`](supabase/setup.sql), and run it. This creates the private `recordings` bucket, metadata table, and owner-scoped Row Level Security policies.
2. In **Authentication → URL Configuration**, add your local URL (for example `http://localhost:3000/**`) and your deployed Vercel URL (for example `https://your-app.vercel.app/**`) to the allowed redirect URLs.
3. Keep public signups disabled and invite department researchers from **Authentication → Users**. The app requests magic-link sign-in for existing users only.
4. From **Project Settings → API Keys**, copy the Project URL and the `sb_publishable_...` key. A legacy `anon` key also works.

## 2. Set environment variables

For local development, copy `.env.local` to `.env.local` and set:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

In Vercel, add the same variables under **Project → Settings → Environment Variables** for Preview and Production, then redeploy. If the Supabase Vercel integration already created these variables, confirm the names and values match. Restart `npm run dev` after changing local variables.

Never put a `service_role` or secret key in a `NEXT_PUBLIC_` variable. Only the publishable/anon key belongs in browser code; the RLS policies enforce per-user access.

## 3. Save a recording

Sign in before recording. After you stop, choose **Save to Supabase** to upload the media and its session details. **Download copy** remains available for a local copy. The bucket is private; files are stored under the authenticated user's ID and are not publicly accessible.
