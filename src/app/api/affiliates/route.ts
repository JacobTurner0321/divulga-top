import { NextRequest, NextResponse } from "next/server";
import { getSessionEmail } from "@/lib/auth";
import { getAffiliates, saveAffiliatesBatch, Platform } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await getSessionEmail())) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const siteId = parseInt(req.nextUrl.searchParams.get("site_id") || "1", 10);
  return NextResponse.json(await getAffiliates(siteId));
}

export async function POST(req: NextRequest) {
  if (!(await getSessionEmail())) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const body = await req.json();
    const siteId = body.site_id as number;
    const affiliates = body.affiliates as { platform: Platform; affiliate_id: string }[];

    await saveAffiliatesBatch(siteId, affiliates);

    const saved = await getAffiliates(siteId);
    return NextResponse.json({ ok: true, affiliates: saved });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao salvar" },
      { status: 500 }
    );
  }
}
