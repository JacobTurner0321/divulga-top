import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "divulga-top-secret-key-2026");

export async function createToken(email: string) {
  return new SignJWT({ email })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(SECRET);
}

export async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload.email as string;
  } catch {
    return null;
  }
}

export async function getSessionEmail() {
  const token = cookies().get("divulga_token")?.value;
  if (!token) return null;
  return verifyToken(token);
}
