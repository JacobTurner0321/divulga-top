"use client";

import type { Product, Site } from "@/lib/types";
import { platformLabel, platformColor } from "@/lib/affiliate";

function formatPrice(value: number | null) {
  if (value === null) return "Consultar";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function ProductCard({ product, index = 0 }: { product: Product; index?: number }) {
  return (
    <div
      className="card-hover animate-fade-in-up group flex flex-col overflow-hidden rounded-2xl border border-white/5 bg-[#141820]/90 backdrop-blur-sm"
      style={{ animationDelay: `${index * 0.07}s` }}
    >
      <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-[#1e2433] to-[#141820]">
        {product.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image_url}
            alt={product.title}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-110"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-5xl opacity-20">🛍️</div>
        )}
        {product.discount_percent && product.discount_percent > 0 && (
          <span className="absolute left-2 top-2 rounded-lg bg-red-500 px-2.5 py-1 text-xs font-bold shadow-lg">
            -{product.discount_percent}%
          </span>
        )}
        <span
          className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase text-white shadow ${platformColor(product.platform)}`}
        >
          {platformLabel(product.platform)}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="mb-3 line-clamp-2 flex-1 text-sm font-medium leading-snug text-slate-100 group-hover:text-white">
          {product.title}
        </h3>
        <div className="mb-4">
          <p className="text-2xl font-bold text-yellow-400">{formatPrice(product.price)}</p>
          {product.original_price && product.original_price > (product.price || 0) && (
            <p className="text-xs text-slate-500 line-through">{formatPrice(product.original_price)}</p>
          )}
        </div>
        <a
          href={product.affiliate_url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="btn-offer group/btn relative block w-full overflow-hidden rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 py-3 text-center text-sm font-bold text-white"
        >
          <span className="relative z-10">Ver Oferta →</span>
          <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover/btn:translate-x-full" />
        </a>
      </div>
    </div>
  );
}

export function ProductGrid({ products }: { products: Product[] }) {
  if (products.length === 0) {
    return (
      <div className="animate-fade-in-up rounded-2xl border border-dashed border-white/10 bg-white/[0.02] py-24 text-center">
        <p className="text-4xl mb-3">🔍</p>
        <p className="text-slate-400">Nenhuma oferta disponível no momento.</p>
        <p className="mt-1 text-sm text-slate-500">Adicione produtos no painel admin.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {products.map((p, i) => (
        <ProductCard key={p.id} product={p} index={i} />
      ))}
    </div>
  );
}

export function SiteHeader({ site, sites }: { site: Site; sites: Site[] }) {
  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-[#0a0c10]/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
        <div className="flex items-center gap-3">
          {site.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={site.logo_url} alt={site.name} className="h-11 w-11 rounded-xl object-cover ring-2 ring-emerald-500/30" />
          ) : (
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-xl font-bold shadow-lg shadow-emerald-500/20">
              D
            </div>
          )}
          <div>
            <h1 className="text-lg font-bold tracking-tight">{site.name}</h1>
            <p className="text-xs text-slate-400">Melhores ofertas do Brasil</p>
          </div>
        </div>
        {sites.length > 1 && (
          <nav className="hidden gap-1 md:flex">
            {sites.map((s, i) => (
              <a
                key={s.id}
                href={s.slug === "default" ? "/" : `/s/${s.slug}`}
                className={`animate-slide-in rounded-xl px-4 py-2 text-sm font-medium transition ${
                  s.id === site.id
                    ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30"
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                }`}
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                {s.name}
              </a>
            ))}
          </nav>
        )}
        <a
          href="/admin"
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-slate-300 transition hover:border-emerald-500/40 hover:text-emerald-400"
        >
          Admin
        </a>
      </div>
    </header>
  );
}

export function PlatformFilter({ current, basePath = "/" }: { current?: string; basePath?: string }) {
  const filters = [
    { key: "", label: "Todos", emoji: "✨" },
    { key: "mercado_livre", label: "Mercado Livre", emoji: "🛒" },
    { key: "amazon", label: "Amazon", emoji: "📦" },
    { key: "shopee", label: "Shopee", emoji: "🧡" },
  ];

  return (
    <div className="mb-8 flex flex-wrap gap-2">
      {filters.map((f) => (
        <a
          key={f.key}
          href={f.key ? `${basePath}?platform=${f.key}` : basePath}
          className={`rounded-full px-5 py-2.5 text-sm font-medium transition-all duration-200 ${
            (current || "") === f.key
              ? "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/25 scale-105"
              : "bg-white/5 text-slate-300 hover:bg-white/10 hover:scale-105"
          }`}
        >
          {f.emoji} {f.label}
        </a>
      ))}
    </div>
  );
}
