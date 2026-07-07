"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { platformLabel } from "@/lib/affiliate";

interface Affiliate {
  id: number;
  platform: string;
  affiliate_id: string;
}

interface Site {
  id: number;
  name: string;
}

const PLATFORMS = ["mercado_livre", "amazon", "shopee"] as const;

export default function AfiliadosAdmin() {
  const router = useRouter();
  const [sites, setSites] = useState<Site[]>([]);
  const [siteId, setSiteId] = useState(1);
  const [affiliates, setAffiliates] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [loadingAffiliates, setLoadingAffiliates] = useState(false);

  useEffect(() => {
    fetch("/api/sites")
      .then((r) => r.json())
      .then(setSites);
    void loadAffiliates(1);
  }, []);

  async function loadAffiliates(id: number) {
    setLoadingAffiliates(true);
    try {
      const res = await fetch(`/api/affiliates?site_id=${id}`, { cache: "no-store" });
      if (res.status === 401) {
        router.push("/admin/login");
        return;
      }
      const data: Affiliate[] = await res.json();
      const map: Record<string, string> = {};
      PLATFORMS.forEach((p) => {
        map[p] = "";
      });
      data.forEach((a) => {
        map[a.platform] = a.affiliate_id || "";
      });
      setAffiliates(map);
    } finally {
      setLoadingAffiliates(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);

    const res = await fetch("/api/affiliates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        site_id: siteId,
        affiliates: PLATFORMS.map((p) => ({ platform: p, affiliate_id: affiliates[p] || "" })),
      }),
    });

    const data = await res.json();
    setSaving(false);

    if (res.ok) {
      setSaved(true);
      if (data.affiliates) {
        const map: Record<string, string> = {};
        data.affiliates.forEach((a: Affiliate) => {
          map[a.platform] = a.affiliate_id || "";
        });
        setAffiliates(map);
      } else {
        await loadAffiliates(siteId);
      }
      setTimeout(() => setSaved(false), 4000);
    } else {
      setError(data.error || "Erro ao salvar. Tente novamente.");
    }
  }

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Minhas Afiliações</h1>
      <p className="mb-8 text-slate-400">
        Configure seus IDs de afiliado para cada plataforma. Eles serão aplicados automaticamente em todos os links.
      </p>

      <div className="mb-6">
        <label className="mb-1 block text-sm text-slate-400">Site</label>
        <select
          value={siteId}
          disabled={loadingAffiliates}
          onChange={(e) => {
            const id = parseInt(e.target.value, 10);
            setSiteId(id);
            void loadAffiliates(id);
          }}
          className="rounded-xl border border-white/10 bg-[#1a1d27] px-4 py-3 text-sm"
        >
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <form onSubmit={handleSave} className="grid gap-4 sm:grid-cols-1 lg:grid-cols-3">
        {PLATFORMS.map((platform) => (
          <div
            key={platform}
            className="rounded-2xl border border-white/5 bg-[#1a1d27] p-6 transition hover:border-emerald-500/20"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold">{platformLabel(platform)}</h3>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  affiliates[platform]
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-yellow-500/20 text-yellow-400"
                }`}
              >
                {affiliates[platform] ? "Configurado" : "Pendente"}
              </span>
            </div>
            <label className="mb-1 block text-xs text-slate-400">ID de Afiliado</label>
            <input
              type="text"
              value={affiliates[platform] || ""}
              onChange={(e) => setAffiliates({ ...affiliates, [platform]: e.target.value })}
              placeholder={`Seu ID ${platformLabel(platform)}`}
              className="w-full rounded-xl border border-white/10 bg-[#0f1117] px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
            />
          </div>
        ))}
        <div className="lg:col-span-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-8 py-3 font-semibold text-white transition hover:shadow-lg hover:shadow-emerald-500/25 disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Salvar Afiliações"}
          </button>
          {saved && (
            <span className="ml-4 text-sm font-medium text-emerald-400">✓ Salvo com sucesso!</span>
          )}
          {error && <span className="ml-4 text-sm text-red-400">{error}</span>}
        </div>
      </form>
    </div>
  );
}
