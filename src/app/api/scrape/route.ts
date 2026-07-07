import { NextRequest, NextResponse } from "next/server";
import { getSessionEmail } from "@/lib/auth";
import { scrapeProduct } from "@/lib/scraper";

export async function POST(req: NextRequest) {
  if (!(await getSessionEmail())) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { url } = await req.json();
  if (!url) return NextResponse.json({ error: "URL obrigatória" }, { status: 400 });

  try {
    const data = await scrapeProduct(url);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro ao buscar produto" }, { status: 400 });
  }
}
