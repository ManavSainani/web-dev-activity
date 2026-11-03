import { NextResponse } from "next/server";
import { ACCESS_COOKIE, readAccessSession } from "../../../../lib/access-session";

export async function GET(request) {
  try {
    const session = readAccessSession(request.cookies.get(ACCESS_COOKIE)?.value);
    const response = NextResponse.json({ active: Boolean(session), expiresAt: session?.expiresAt ?? null });
    if (!session) response.cookies.delete(ACCESS_COOKIE);
    return response;
  } catch {
    return NextResponse.json({ active: false });
  }
}
