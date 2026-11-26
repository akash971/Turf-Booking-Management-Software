import crypto from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "turf_admin_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12; // 12 hours

let warnedMissingProdSecrets = false;

function warnIfDefaultSecretsInProd(): void {
  if (warnedMissingProdSecrets || process.env.NODE_ENV !== "production") return;
  if (!process.env.ADMIN_PASSWORD || !process.env.ADMIN_SESSION_SECRET) {
    warnedMissingProdSecrets = true;
    console.warn(
      "[auth] Warning: ADMIN_PASSWORD or ADMIN_SESSION_SECRET is not set in production. Set both in your Render environment variables."
    );
  }
}

function getAdminPassword(): string {
  warnIfDefaultSecretsInProd();
  return process.env.ADMIN_PASSWORD || "admin123";
}

function getSessionSecret(): string {
  warnIfDefaultSecretsInProd();
  return (
    process.env.ADMIN_SESSION_SECRET ||
    "emerald-arena-fallback-secret-change-in-prod"
  );
}

function signToken(payload: string): string {
  return crypto
    .createHmac("sha256", getSessionSecret())
    .update(payload)
    .digest("hex");
}

export function verifyAdminPassword(password: string): boolean {
  const expected = getAdminPassword();
  const a = Buffer.from(password, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function createSessionToken(): string {
  const expiresAt = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
  const nonce = crypto.randomBytes(12).toString("hex");
  const payload = `${expiresAt}.${nonce}`;
  const sig = signToken(payload);
  return `${payload}.${sig}`;
}

export function verifySessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;

  const [expiresAtStr, nonce, providedSig] = parts;
  const expiresAt = Number(expiresAtStr);
  if (Number.isNaN(expiresAt) || expiresAt < Date.now()) {
    return false;
  }

  const payload = `${expiresAtStr}.${nonce}`;
  const expectedSig = signToken(payload);

  const a = Buffer.from(providedSig, "utf8");
  const b = Buffer.from(expectedSig, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  return verifySessionToken(token);
}

export async function setAdminSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  const token = createSessionToken();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearAdminSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
