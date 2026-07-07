"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Site {
  id: number;
  name: string;
  slug: string;
  logo_url: string | null;
}

export default function SitesAdmin() {
  const router = useRouter();
  const [sites, setSites] = useState<Site[]>([]);
  const [editing, setEditing] = useState<Record<number, { name: string; logo_url: string }>>({});

  useEffect(() => {
    fetch("/api/sites")
      .then((r) => {
        if (r.status === 401) {
          router.push("/admin/login");
          return [];
        }
        return r.json();
      })
      .then((data: Site[]) => {
        setSites(data);
        const edit: Record<number, { name: string; logo_url: string }> = {};
        data.forEach((s) => {
          edit[s.id] = { name: s.name, logo_url: s.logo_url || "" };
        });
        setEditing(edit);
      });
  }, [router]);

  async function saveSite(id: number) {
    await fetch("/api/sites", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...editing[id] }),
    });
    alert("Site atualizado!");
  }

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Meus Sites</h1>
      <p className="mb-8 text-slate-400">
        Gerencie até 3 vitrines diferentes. Cada site tem produtos e afiliações separados.
      </p>

      <div className="grid gap-4">
        {sites.map((site) => (
          <div key={site.id} className="rounded-2xl border border-white/5 bg-[#1a1d27] p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold">{site.name}</h3>
              <a
                href={site.slug === "default" ? "/" : `/s/${site.slug}`}
                target="_blank"
                className="text-xs text-emerald-400 hover:underline"
              >
                Ver vitrine →
              </a>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-slate-400">Nome do Site</label>
                <input
                  type="text"
                  value={editing[site.id]?.name || ""}
                  onChange={(e) =>
                    setEditing({ ...editing, [site.id]: { ...editing[site.id], name: e.target.value } })
                  }
                  className="w-full rounded-xl border border-white/10 bg-[#0f1117] px-4 py-3 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">URL do Logo (opcional)</label>
                <input
                  type="url"
                  value={editing[site.id]?.logo_url || ""}
                  onChange={(e) =>
                    setEditing({ ...editing, [site.id]: { ...editing[site.id], logo_url: e.target.value } })
                  }
                  placeholder="https://..."
                  className="w-full rounded-xl border border-white/10 bg-[#0f1117] px-4 py-3 text-sm"
                />
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              URL: {site.slug === "default" ? "divulga.top" : `divulga.top/s/${site.slug}`}
            </p>
            <button
              onClick={() => saveSite(site.id)}
              className="mt-4 rounded-xl bg-emerald-500 px-6 py-2 text-sm font-semibold text-white hover:bg-emerald-600"
            >
              Salvar
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
