import "server-only";
import { NextResponse } from "next/server";
import { ACCESS_COOKIE, readAccessSession } from "../../../../lib/access-session";
import { getSupabaseAdminClient } from "../../../../lib/supabase-admin";
import { parseRecordingDetails } from "../../../../lib/recording-details";

export const runtime = "nodejs";

export async function POST(request) {
  const session = readAccessSession(request.cookies.get(ACCESS_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Your recording session expired. Enter a new key." }, { status: 401 });

  let details;
  try {
    details = parseRecordingDetails(await request.json());
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdminClient();
    const { id } = details;
    const extension = details.content_type.includes("mp4") ? "mp4" : "webm";
    const objectPath = `${session.tokenId}/${id}.${extension}`;
    const { data: existing, error: findError } = await supabase.from('recording_uploads')
      .select('id, access_token_id, session_id, object_path, status')
      .eq('id', id).maybeSingle();
    if (findError) throw findError;
    if (existing && (existing.access_token_id !== session.tokenId || existing.session_id !== details.session_id || existing.object_path !== objectPath)) {
      return NextResponse.json({ error: 'Recording ID is already in use.' }, { status: 409 });
    }
    if (existing?.status === 'saved') return NextResponse.json({ id, saved: true });
    const { data: signedUpload, error: signError } = await supabase.storage
      .from("recordings")
      .createSignedUploadUrl(objectPath, { upsert: false });
    if (signError) throw signError;

    if (!existing) {
      const { error: insertError } = await supabase.from("recording_uploads").insert({
        ...details, access_token_id: session.tokenId, object_path: objectPath,
      });
      if (insertError) throw insertError;
    }

    const uploadUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL);
    if (uploadUrl.hostname.endsWith('.supabase.co')) {
      uploadUrl.hostname = uploadUrl.hostname.replace('.supabase.co', '.storage.supabase.co');
    }
    uploadUrl.pathname = '/storage/v1/upload/resumable';
    return NextResponse.json({ id, path: objectPath, uploadToken: signedUpload.token, uploadEndpoint: uploadUrl.toString() });
  } catch (error) {
    console.error("Could not prepare recording upload:", error.message);
    return NextResponse.json({ error: "Could not prepare secure storage. Try again." }, { status: 503 });
  }
}
