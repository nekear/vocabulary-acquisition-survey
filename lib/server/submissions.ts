import "server-only";

import { randomBytes } from "node:crypto";

export async function hashTokenSha256(token: string) {
  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );

  return [...new Uint8Array(hashBuffer)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

export function generateWithdrawalToken(byteLength: number) {
  return randomBytes(byteLength).toString("base64url");
}
