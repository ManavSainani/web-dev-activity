import "server-only";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { ACCESS_COOKIE, readAccessSession } from "../../../../lib/access-session";
import { getSupabaseAdminClient } from "../../../../lib/supabase-admin";

export const runtime = "nodejs";
const maxFileBytes = 500 * 1024 * 1024;
const allowedTypes = new Set(["video/webm", "audio/webm", "video/mp4", "audio/mp4"]);

export async function POST(request) {
  const session = readAccessSession(request.cookies.get(ACCESS_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Your recording session expired. Enter a new key." }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const mode = body.mode;
  const contentType = typeof body.contentType === "string" ? body.contentType : "";
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 120) : "";
  const durationSeconds = Number(body.durationSeconds);
  const fileSizeBytes = Number(body.fileSizeBytes);
  if (
    !["audio", "video"].includes(mode) ||
    !allowedTypes.has(contentType) ||
    !Number.isInteger(durationSeconds) || durationSeconds < 0 || durationSeconds > 6 * 60 * 60 ||
    !Number.isInteger(fileSizeBytes) || fileSizeBytes < 1 || fileSizeBytes > maxFileBytes
  ) {
    return NextResponse.json({ error: "Recording details are not valid or exceed the 500 MB limit." }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdminClient();
    const id = randomUUID();
    const extension = contentType.includes("mp4") ? "mp4" : "webm";
    const objectPath = `${session.tokenId}/${id}.${extension}`;
    const { data: signedUpload, error: signError } = await supabase.storage
      .from("recordings")
      .createSignedUploadUrl(objectPath, { upsert: false });
    if (signError) throw signError;

    const { error: insertError } = await supabase.from("recording_uploads").insert({
      id,
      access_token_id: session.tokenId,
      title: title || `${mode === "video" ? "Video" : "Audio"} recording`,
      mode,
      object_path: objectPath,
      duration_seconds: durationSeconds,
      file_size_bytes: fileSizeBytes,
      content_type: contentType,
    });
    if (insertError) throw insertError;

    return NextResponse.json({ id, path: objectPath, uploadToken: signedUpload.token });
  } catch (error) {
    console.error("Could not prepare recording upload:", error.message);
    return NextResponse.json({ error: "Could not prepare secure storage. Try again." }, { status: 503 });
  }
}
