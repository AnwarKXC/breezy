import "server-only";

import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

// OWASP-recommended scrypt parameters (N=2^17, r=8, p=1).
const PARAMS = { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };
const KEY_LENGTH = 64;

function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, PARAMS, (error, key) => (error ? reject(error) : resolve(key)));
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  return `scrypt:${salt}:${(await derive(password, salt)).toString("hex")}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [scheme, salt, hash] = encoded.split(":");
  if (scheme !== "scrypt" || !/^[a-f0-9]{32}$/.test(salt ?? "") || !/^[a-f0-9]{128}$/.test(hash ?? "")) {
    return false;
  }
  return timingSafeEqual(await derive(password, salt), Buffer.from(hash, "hex"));
}

// Verified against when the email is unknown so response time does not reveal
// which accounts exist.
export const DUMMY_PASSWORD_HASH = `scrypt:${"0".repeat(32)}:${"0".repeat(128)}`;
