import type { Platform } from "@/lib/types";
import { getSites, getSiteBySlug, getProducts, removeInvalidProducts } from "@/lib/db";
import { SiteHeader, ProductGrid, PlatformFilter } from "@/components/ProductGrid";

interface Props {
  slug?: string;
  platform?: Platform;
}

export default async function VitrinePage({ slug, platform }: Props) {
  const site = slug ? await getSiteBySlug(slug) : await getSiteBySlug("default");
  if (!site) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-400">
        Site não encontrado.
      </div>
    );
  }

  await removeInvalidProducts();
  const sites = await getSites(true);
  const products = await getProducts(site.id, platform);
  const basePath = site.slug === "default" ? "/" : `/s/${site.slug}`;

  return (
    <div className="min-h-screen">
      <SiteHeader site={site} sites={sites} />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8 animate-fade-in-up">
          <h2 className="bg-gradient-to-r from-white to-slate-400 bg-clip-text text-3xl font-bold text-transparent">
            As Melhores Ofertas em Um Só Lugar
          </h2>
          <p className="mt-2 text-slate-400">
            Compare preços de Mercado Livre, Amazon e Shopee. Economize tempo e dinheiro.
          </p>
        </div>
        <PlatformFilter current={platform} basePath={basePath} />
        <div className="mb-6 animate-fade-in-up flex items-center gap-2">
          <span className="animate-pulse-hot rounded-lg bg-red-500 px-2.5 py-1 text-xs font-bold text-white">
            HOT
          </span>
          <h3 className="text-lg font-semibold">Ofertas em Destaque</h3>
          <span className="text-sm text-slate-500">({products.length} produtos)</span>
        </div>
        <ProductGrid products={products} />
      </main>
      <footer className="mt-16 border-t border-white/5 py-8 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} {site.name} — Ofertas com links de afiliado
      </footer>
    </div>
  );
}
