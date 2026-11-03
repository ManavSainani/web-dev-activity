import "server-only";
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "../../../../lib/supabase-admin";

export const runtime = "nodejs";
const allowedExpiries = new Set([1, 24, 168, 720]);

function adminKeyMatches(providedKey) {
  const expectedKey = process.env.TOKEN_ADMIN_KEY;
  if (!expectedKey || expectedKey.length < 32 || typeof providedKey !== "string") return false;
  const expected = Buffer.from(expectedKey);
  const provided = Buffer.from(providedKey);
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}

export async function POST(request) {
  try {
    const body = await request.json();
    if (!adminKeyMatches(body.adminKey)) {
      return NextResponse.json({ error: "Admin key is incorrect." }, { status: 403 });
    }

    const hours = Number(body.expiresInHours);
    if (!allowedExpiries.has(hours)) {
      return NextResponse.json({ error: "Choose one of the listed expiry periods." }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    const { data: token, error } = await supabase.rpc("issue_access_token", {
      p_lifetime: `${hours} hours`,
    });
    if (error) {
      console.error("Could not issue an access token:", error.message);
      return NextResponse.json({ error: "Token creation failed. Check the Supabase setup." }, { status: 503 });
    }
    return NextResponse.json({ token, expiresInHours: hours });
  } catch (error) {
    console.error("Token creation request failed:", error.message);
    return NextResponse.json({ error: "Token creation is temporarily unavailable." }, { status: 503 });
  }
}
