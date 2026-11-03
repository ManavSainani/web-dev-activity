import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

export const ACCESS_COOKIE = "record_access";
export const ACCESS_SESSION_SECONDS = 30 * 60;

function sessionSecret() {
  const secret = process.env.ACCESS_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("ACCESS_SESSION_SECRET must be set to a random secret of at least 32 characters.");
  }
  return secret;
}

export function createAccessSession(tokenId) {
  const payload = Buffer.from(
    JSON.stringify({ tokenId, expiresAt: Date.now() + ACCESS_SESSION_SECONDS * 1000 }),
  ).toString("base64url");
  const signature = createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function readAccessSession(value) {
  if (!value) return null;
  const [payload, providedSignature, extra] = value.split(".");
  if (!payload || !providedSignature || extra) return null;

  let expectedSignature;
  try {
    expectedSignature = createHmac("sha256", sessionSecret()).update(payload).digest();
    const actualSignature = Buffer.from(providedSignature, "base64url");
    if (actualSignature.length !== expectedSignature.length || !timingSafeEqual(actualSignature, expectedSignature)) {
      return null;
    }
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof session.tokenId !== "string" || session.expiresAt <= Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}
