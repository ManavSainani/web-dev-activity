import { NextResponse } from "next/server";
import { ACCESS_COOKIE, ACCESS_SESSION_SECONDS, createAccessSession } from "../../../../lib/access-session";
import { getSupabaseAdminClient } from "../../../../lib/supabase-admin";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    if (!process.env.ACCESS_SESSION_SECRET || process.env.ACCESS_SESSION_SECRET.length < 32) {
      return NextResponse.json({ error: "Recording access is not configured yet." }, { status: 503 });
    }
    const body = await request.json();
    const token = typeof body.token === "string" ? body.token.trim().toLowerCase() : "";
    if (!/^[a-f0-9]{64}$/.test(token)) {
      return NextResponse.json({ error: "That key is invalid, expired, or already used." }, { status: 401 });
    }

    const supabase = getSupabaseAdminClient();
    const { data: tokenId, error } = await supabase.rpc("redeem_access_token", { p_token: token });
    if (error) {
      console.error("Access-key redemption failed:", error.message);
      return NextResponse.json({ error: "Access verification is temporarily unavailable." }, { status: 503 });
    }
    if (!tokenId) {
      return NextResponse.json({ error: "That key is invalid, expired, or already used." }, { status: 401 });
    }

    const expiresAt = Date.now() + ACCESS_SESSION_SECONDS * 1000;
    const response = NextResponse.json({ ok: true, expiresAt });
    response.cookies.set(ACCESS_COOKIE, createAccessSession(tokenId), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: ACCESS_SESSION_SECONDS,
    });
    return response;
  } catch (error) {
    console.error("Access verification could not run:", error.message);
    return NextResponse.json({ error: "Access verification is temporarily unavailable." }, { status: 503 });
  }
}
