# Fieldnote

Run `npm install` and `npm run dev` to start the Next.js app.

## Supabase setup

1. Copy `.env.example` to `.env.local` and supply your Supabase project URL,
   server secret key, and a random `ACCESS_SESSION_SECRET` of at least 32 characters.
   Configure these same variables in your deployment environment. Never expose the
   server secret key in a `NEXT_PUBLIC_` variable or commit `.env.local`.
2. For a new project, run `supabase/setup.sql` in Supabase's SQL Editor. For an
   existing installation of that script, run
   `supabase/migrations/20261103_recording_metadata.sql` instead.
3. In the SQL Editor, issue a one-time researcher key:

   ```sql
   select private.issue_access_token(interval '24 hours');
   ```

   The returned key can be redeemed once, before it expires. Enter it in the
   website's researcher access form. The resulting browser session lasts four
   hours, allowing time for a one-hour video and its upload.
4. Record a short video, stop it, review it, and click **Save video**. Confirm the
   object appears in the private `recordings` bucket and its row in
   `public.recording_uploads` has `status = 'saved'` and the matching `session_id`.

Saving uses signed, resumable uploads directly to Supabase Storage in 6 MB
chunks. Video bytes do not pass through Next.js request bodies. The server checks
the uploaded object's size and media type before marking it saved. A failed save
keeps the current video available for retry; do not reload or start another
recording until it has saved. Saved recordings are no longer stored in IndexedDB.

The bucket and API currently permit files up to **500 MB**. Your Supabase project
must also allow that size under its global Storage settings. One-hour videos can
exceed this size depending on the browser's bitrate; larger uploads require a
compatible Supabase plan/global limit and matching changes to the bucket limit
and `MAX_FILE_BYTES` in `lib/recording-details.js`.

Session labels are stored alongside an independent UUID for each recording;
the short visible label is metadata, not the database primary key. Audio saves
use the same protected upload flow. No public read/write Storage policies are
needed: only the server can create upload permissions and change metadata.

Run `npm test` for upload-flow and metadata validation tests, and `npm run build`
for the production build. Automated tests mock Supabase/network operations;
the short-video check above verifies your actual project's configuration.
