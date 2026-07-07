import { NextRequest, NextResponse } from "next/server";
import { getSessionEmail } from "@/lib/auth";
import {
  getAllProductsAdmin,
  getProducts,
  insertProduct,
  deleteProduct,
  toggleProduct,
  getAffiliates,
} from "@/lib/db";
import { applyAffiliateId } from "@/lib/affiliate";
import { scrapeProduct, parseMultipleUrls } from "@/lib/scraper";
import { isValidProductTitle } from "@/lib/validate";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const siteId = req.nextUrl.searchParams.get("site_id");
  const publicOnly = req.nextUrl.searchParams.get("public") === "1";

  if (publicOnly) {
    const id = siteId ? parseInt(siteId, 10) : undefined;
    return NextResponse.json(await getProducts(id));
  }

  if (!(await getSessionEmail())) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const id = siteId ? parseInt(siteId, 10) : undefined;
  return NextResponse.json(await getAllProductsAdmin(id));
}

export async function POST(req: NextRequest) {
  if (!(await getSessionEmail())) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();
  const siteId = (body.site_id as number) || 1;
  const urls: string[] = body.urls ? parseMultipleUrls(body.urls) : body.url ? [body.url] : [];

  if (urls.length === 0) {
    return NextResponse.json({ error: "Nenhum link válido encontrado" }, { status: 400 });
  }

  const affiliates = await getAffiliates(siteId);
  const affiliateMap = Object.fromEntries(affiliates.map((a) => [a.platform, a.affiliate_id]));
  const results = [];

  for (const url of urls.slice(0, 30)) {
    try {
      const scraped = await scrapeProduct(url);
      if (!isValidProductTitle(scraped.title)) {
        throw new Error("Dados do produto inválidos. Use o link completo da página.");
      }
      const affiliateUrl = applyAffiliateId(
        scraped.source_url,
        scraped.platform,
        affiliateMap[scraped.platform] || ""
      );
      const id = await insertProduct({
        site_id: siteId,
        title: scraped.title,
        image_url: scraped.image_url,
        price: scraped.price,
        original_price: scraped.original_price,
        discount_percent: scraped.discount_percent,
        platform: scraped.platform,
        source_url: scraped.source_url,
        affiliate_url: affiliateUrl,
      });
      results.push({ ok: true, id, title: scraped.title, url });
    } catch (e) {
      results.push({ ok: false, url, error: e instanceof Error ? e.message : "Erro ao importar" });
    }
  }

  const successCount = results.filter((r) => r.ok).length;
  if (successCount === 0 && results.length > 0) {
    return NextResponse.json({ results, total: 0, error: "Nenhum produto importado" }, { status: 422 });
  }

  return NextResponse.json({ results, total: successCount });
}

export async function DELETE(req: NextRequest) {
  if (!(await getSessionEmail())) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const id = parseInt(req.nextUrl.searchParams.get("id") || "0", 10);
  if (id) await deleteProduct(id);
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  if (!(await getSessionEmail())) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { id, active } = await req.json();
  await toggleProduct(id, active ? 1 : 0);
  return NextResponse.json({ ok: true });
}
