// PROTOTYPE CONTROL: Noor's 4-digit farm code. The pack carries only a salted, slowed hash of it,
// so the phone can check the code with no network and the code itself is never in the pack. After
// the guest shows an order, Noor types the code to confirm payment (non-negotiable 6: a guest
// alone cannot make a sale).
//
// Honest limits, written here and in the docs: a 4-digit code has only 10,000 values, so anyone
// who has the pack can find it offline by trying them all (PBKDF2 slows that down; it does not stop
// it). This is a speed bump against a guest tapping the button, not strong authentication. The real
// confirmation belongs on Noor's own device or the cooperative dashboard.

export const FARM_CODE_ITERATIONS = 100_000;
export const FARM_CODE_PATTERN = /^\d{4}$/;

export interface FarmCode {
  algorithm: "pbkdf2-sha256";
  iterations: number;
  salt: string; // hex
  hash: string; // hex
  prototype: true; // the UI labels it as a prototype control
}

const hex = (bytes: ArrayBuffer) =>
  [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");

/** Deterministic per farm, so a rebuilt pack with the same code is byte-identical. */
async function saltFor(farmSlug: string): Promise<string> {
  const data = new TextEncoder().encode(`asknoor-farm-code:${farmSlug}`);
  return hex(await crypto.subtle.digest("SHA-256", data)).slice(0, 32);
}

async function derive(code: string, salt: string, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(code),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: new TextEncoder().encode(salt), iterations },
    key,
    256,
  );
  return hex(bits);
}

export async function makeFarmCode(code: string, farmSlug: string): Promise<FarmCode> {
  if (!FARM_CODE_PATTERN.test(code)) throw new Error("the farm code must be exactly 4 digits");
  const salt = await saltFor(farmSlug);
  return {
    algorithm: "pbkdf2-sha256",
    iterations: FARM_CODE_ITERATIONS,
    salt,
    hash: await derive(code, salt, FARM_CODE_ITERATIONS),
    prototype: true,
  };
}

export async function verifyFarmCode(entered: string, farmCode: FarmCode): Promise<boolean> {
  if (!FARM_CODE_PATTERN.test(entered)) return false;
  const hash = await derive(entered, farmCode.salt, farmCode.iterations);
  // Compare every character, whatever the result, so timing says nothing about the first difference.
  let diff = hash.length ^ farmCode.hash.length;
  for (let i = 0; i < hash.length; i++)
    diff |= hash.charCodeAt(i) ^ (farmCode.hash.charCodeAt(i) || 0);
  return diff === 0;
}
