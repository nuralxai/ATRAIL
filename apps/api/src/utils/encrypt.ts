import crypto from "crypto";
import { env } from "../env.js";

const KEY_BUF = Buffer.from(env.ENCRYPTION_KEY, "base64");

if (KEY_BUF.length !== 32) {
  throw new Error("ENCRYPTION_KEY must decode to exactly 32 bytes base64");
}

export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY_BUF, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${enc.toString("base64")}`;
}

export function decrypt(stored: string): string {
  const [ivB64, tagB64, encB64] = stored.split(".");
  if (!ivB64 || !tagB64 || !encB64) {
    throw new Error("Invalid stored ciphertext format");
  }
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const enc = Buffer.from(encB64, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", KEY_BUF, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}
