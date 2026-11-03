import "server-only";
import { NextResponse } from "next/server";
import { ACCESS_COOKIE, readAccessSession } from "../../../../lib/access-session";
import { getSupabaseAdminClient } from "../../../../lib/supabase-admin";
import { UUID_PATTERN } from "../../../../lib/recording-details";

export const runtime = "nodejs";

export async function POST(request) {
  const session = readAccessSession(request.cookies.get(ACCESS_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Your recording session expired. Enter a new key." }, { status: 401 });

  let id;
  try {
    id = (await request.json()).id;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (typeof id !== "string" || !UUID_PATTERN.test(id)) {
    return NextResponse.json({ error: "Invalid recording." }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdminClient();
    const { data: recording, error: findError } = await supabase
      .from("recording_uploads")
      .select("id, object_path, status, file_size_bytes, content_type")
      .eq("id", id)
      .eq("access_token_id", session.tokenId)
      .maybeSingle();
    if (findError) throw findError;
    if (!recording) return NextResponse.json({ error: "Recording not found for this session." }, { status: 404 });
    if (recording.status === "saved") return NextResponse.json({ ok: true });

    const slash = recording.object_path.lastIndexOf("/");
    const folder = recording.object_path.slice(0, slash);
    const filename = recording.object_path.slice(slash + 1);
    const { data: files, error: listError } = await supabase.storage
      .from("recordings")
      .list(folder, { limit: 1, search: filename });
    if (listError) throw listError;
    const uploaded = files?.find((file) => file.name === filename);
    if (!uploaded) {
      return NextResponse.json({ error: "The upload did not finish. Please retry." }, { status: 409 });
    }
    if (Number(uploaded.metadata?.size) !== recording.file_size_bytes ||
        uploaded.metadata?.mimetype?.split(';')[0] !== recording.content_type) {
      return NextResponse.json({ error: 'Uploaded file does not match the recording details.' }, { status: 409 });
    }

    const { error: updateError } = await supabase
      .from("recording_uploads")
      .update({ status: "saved", saved_at: new Date().toISOString() })
      .eq("id", id)
      .eq("access_token_id", session.tokenId);
    if (updateError) throw updateError;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Could not finalize recording upload:", error.message);
    return NextResponse.json({ error: "The file uploaded but could not be finalized. Contact the administrator." }, { status: 503 });
  }
}
