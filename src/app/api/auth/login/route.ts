import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createToken } from "@/lib/auth";
import { getAdminByEmail } from "@/lib/db";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  const admin = await getAdminByEmail(email);
  if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
    return NextResponse.json({ error: "Email ou senha incorretos" }, { status: 401 });
  }

  const token = await createToken(email);
  const res = NextResponse.json({ ok: true });
  res.cookies.set("divulga_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete("divulga_token");
  return res;
}
