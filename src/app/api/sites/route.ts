import { NextRequest, NextResponse } from "next/server";
import { getSessionEmail } from "@/lib/auth";
import { getSites, updateSite } from "@/lib/db";

export async function GET() {
  return NextResponse.json(await getSites());
}

export async function PATCH(req: NextRequest) {
  if (!(await getSessionEmail())) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { id, name, logo_url } = await req.json();
  await updateSite(id, name, logo_url || null);
  return NextResponse.json({ ok: true });
}
