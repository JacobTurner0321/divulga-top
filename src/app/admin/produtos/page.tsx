"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { platformLabel } from "@/lib/affiliate";

interface Product {
  id: number;
  title: string;
  price: number | null;
  platform: string;
  image_url: string | null;
  active: number;
}

interface Site {
  id: number;
  name: string;
  slug: string;
}

interface ImportResult {
  ok: boolean;
  id?: number;
  title?: string;
  url?: string;
  error?: string;
}

export default function ProdutosAdmin() {
  const router = useRouter();
  const [sites, setSites] = useState<Site[]>([]);
  const [siteId, setSiteId] = useState(1);
  const [urls, setUrls] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/sites").then((r) => r.json()).then(setSites);
    loadProducts(1);
  }, []);

  async function loadProducts(id: number) {
    const res = await fetch(`/api/products?site_id=${id}`, { cache: "no-store" });
    if (res.status === 401) {
      router.push("/admin/login");
      return;
    }
    setProducts(await res.json());
  }

  async function handleCleanupInvalid() {
    setRefreshing(true);
    setMessage("");
    const res = await fetch("/api/products/cleanup", { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      setMessage(`✅ ${data.removed} produto(s) inválido(s) removido(s).`);
      await loadProducts(siteId);
    } else {
      setMessage(`❌ ${data.error || "Erro ao limpar"}`);
    }
    setRefreshing(false);
  }

  async function handleRefreshAll() {
    setRefreshing(true);
    setMessage("");
    setErrors([]);
    const res = await fetch("/api/products/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ site_id: siteId }),
    });
    const data = await res.json();
    if (res.ok) {
      setMessage(`✅ ${data.total} produto(s) atualizado(s)!`);
      await loadProducts(siteId);
    } else {
      setMessage(`❌ ${data.error || "Erro ao atualizar"}`);
    }
    setRefreshing(false);
  }

  async function handleRefreshOne(id: number) {
    const res = await fetch("/api/products/refresh", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const data = await res.json();
    if (res.ok) {
      setMessage(`✅ Produto atualizado: ${data.title}`);
      await loadProducts(siteId);
    } else {
      setMessage(`❌ ${data.error}`);
    }
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setErrors([]);

    const res = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ site_id: siteId, urls }),
    });
    const data = await res.json();

    if (res.ok || res.status === 422) {
      const results: ImportResult[] = data.results || [];
      const failed = results.filter((r) => !r.ok);
      const succeeded = results.filter((r) => r.ok);

      if (succeeded.length > 0) {
        setMessage(`✅ ${succeeded.length} promoção(ões) importada(s) com sucesso!`);
        setUrls("");
      } else {
        setMessage("❌ Nenhum produto foi importado. Veja os erros abaixo.");
      }

      if (failed.length > 0) {
        setErrors(failed.map((r) => `${r.url}: ${r.error}`));
      }

      await loadProducts(siteId);
    } else {
      setMessage(`❌ ${data.error || "Erro ao importar"}`);
    }
    setLoading(false);
  }

  async function handleDelete(id: number) {
    if (!confirm("Remover este produto?")) return;
    await fetch(`/api/products?id=${id}`, { method: "DELETE" });
    loadProducts(siteId);
  }

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Gerar Promoção</h1>
      <p className="mb-8 text-slate-400">
        Cole links de produtos (até 30 de uma vez). O sistema busca nome, preço, imagem e aplica seu ID de afiliado.
      </p>

      <form onSubmit={handleGenerate} className="mb-8 rounded-2xl border border-white/5 bg-[#1a1d27] p-6">
        <div className="mb-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm text-slate-400">Site / Vitrine</label>
            <select
              value={siteId}
              onChange={(e) => {
                const id = parseInt(e.target.value, 10);
                setSiteId(id);
                loadProducts(id);
              }}
              className="w-full rounded-xl border border-white/10 bg-[#0f1117] px-4 py-3 text-sm"
            >
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mb-4">
          <label className="mb-1 block text-sm text-slate-400">Links dos produtos *</label>
          <textarea
            value={urls}
            onChange={(e) => setUrls(e.target.value)}
            placeholder="Cole aqui os links (Mercado Livre, Amazon ou Shopee). Um por linha ou separados por vírgula."
            rows={5}
            className="w-full rounded-xl border border-white/10 bg-[#0f1117] px-4 py-3 text-sm outline-none focus:border-emerald-500"
            required
          />
        </div>
        {message && <p className="mb-4 text-sm">{message}</p>}
        {errors.length > 0 && (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
            <p className="mb-2 text-sm font-medium text-red-400">Erros na importação:</p>
            <ul className="space-y-1 text-xs text-red-300">
              {errors.map((err, i) => (
                <li key={i}>• {err}</li>
              ))}
            </ul>
          </div>
        )}
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-8 py-3 font-semibold text-white transition hover:shadow-lg hover:shadow-emerald-500/25 disabled:opacity-50"
        >
          {loading ? "Importando..." : "Gerar promoção(ões)"}
        </button>
      </form>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Produtos ({products.length})</h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleCleanupInvalid}
            disabled={refreshing}
            className="rounded-lg border border-yellow-500/30 px-3 py-1.5 text-xs text-yellow-400 transition hover:bg-yellow-500/10 disabled:opacity-50"
          >
            Limpar inválidos
          </button>
          {products.length > 0 && (
            <button
              onClick={handleRefreshAll}
              disabled={refreshing}
              className="rounded-lg border border-blue-500/30 px-3 py-1.5 text-xs text-blue-400 hover:bg-blue-500/10 disabled:opacity-50"
            >
              {refreshing ? "Atualizando..." : "Atualizar todos"}
            </button>
          )}
          <a href="/" target="_blank" className="text-sm text-emerald-400 hover:underline">
            Ver vitrine →
          </a>
        </div>
      </div>
      <div className="space-y-3">
        {products.map((p) => (
          <div key={`${p.id}-${p.title}`} className="flex items-center gap-4 rounded-xl border border-white/5 bg-[#1a1d27] p-4">
            {p.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.image_url} alt="" className="h-14 w-14 rounded-lg object-cover" />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-[#252836]">📦</div>
            )}
            <div className="flex-1 min-w-0">
              <p className="truncate font-medium">{p.title}</p>
              <p className="text-sm text-slate-400">
                {platformLabel(p.platform as "mercado_livre" | "amazon" | "shopee")} —{" "}
                {p.price?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) || "—"}
              </p>
            </div>
            <button
              onClick={() => handleRefreshOne(p.id)}
              className="rounded-lg border border-blue-500/30 px-3 py-1.5 text-xs text-blue-400 hover:bg-blue-500/10"
            >
              Atualizar
            </button>
            <button
              onClick={() => handleDelete(p.id)}
              className="rounded-lg border border-red-500/30 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10"
            >
              Remover
            </button>
          </div>
        ))}
        {products.length === 0 && (
          <p className="py-8 text-center text-slate-500">Nenhum produto ainda. Cole links acima para começar.</p>
        )}
      </div>
    </div>
  );
}
