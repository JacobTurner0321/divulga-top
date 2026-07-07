import { NextRequest, NextResponse } from "next/server";
import { getSessionEmail } from "@/lib/auth";
import { getAllProductsAdmin, getProductById, updateProduct, getAffiliates, removeInvalidProducts } from "@/lib/db";
import { applyAffiliateId } from "@/lib/affiliate";
import { scrapeProduct } from "@/lib/scraper";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!(await getSessionEmail())) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { site_id } = await req.json().catch(() => ({}));
  const removed = await removeInvalidProducts();
  const products = await getAllProductsAdmin(site_id ? parseInt(site_id, 10) : undefined);
  const results = [];

  for (const product of products) {
    try {
      const scraped = await scrapeProduct(product.source_url);
      const affiliates = await getAffiliates(product.site_id);
      const affiliateMap = Object.fromEntries(affiliates.map((a) => [a.platform, a.affiliate_id]));
      const affiliateUrl = applyAffiliateId(
        scraped.source_url,
        scraped.platform,
        affiliateMap[scraped.platform] || ""
      );

      await updateProduct(product.id, {
        title: scraped.title,
        image_url: scraped.image_url,
        price: scraped.price,
        original_price: scraped.original_price,
        discount_percent: scraped.discount_percent,
        affiliate_url: affiliateUrl,
      });

      results.push({ ok: true, id: product.id, title: scraped.title });
    } catch (e) {
      results.push({
        ok: false,
        id: product.id,
        error: e instanceof Error ? e.message : "Erro",
      });
    }
  }

  return NextResponse.json({
    results,
    total: results.filter((r) => r.ok).length,
    removed,
  });
}

export async function PUT(req: NextRequest) {
  if (!(await getSessionEmail())) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await req.json();
  const product = await getProductById(id);
  if (!product) return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });

  try {
    const scraped = await scrapeProduct(product.source_url);
    const affiliates = await getAffiliates(product.site_id);
    const affiliateMap = Object.fromEntries(affiliates.map((a) => [a.platform, a.affiliate_id]));
    const affiliateUrl = applyAffiliateId(
      scraped.source_url,
      scraped.platform,
      affiliateMap[scraped.platform] || ""
    );

    await updateProduct(id, {
      title: scraped.title,
      image_url: scraped.image_url,
      price: scraped.price,
      original_price: scraped.original_price,
      discount_percent: scraped.discount_percent,
      affiliate_url: affiliateUrl,
    });

    return NextResponse.json({ ok: true, title: scraped.title });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao atualizar" },
      { status: 422 }
    );
  }
}
