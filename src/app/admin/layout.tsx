"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const nav = [
  { href: "/admin", label: "Dashboard", icon: "📊" },
  { href: "/admin/produtos", label: "Gerar Promoção", icon: "🔗" },
  { href: "/admin/afiliados", label: "Minhas Afiliações", icon: "🤝" },
  { href: "/admin/sites", label: "Meus Sites", icon: "🌐" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  if (pathname === "/admin/login") return <>{children}</>;

  async function logout() {
    await fetch("/api/auth/login", { method: "DELETE" });
    router.push("/admin/login");
  }

  return (
    <div className="flex min-h-screen bg-[#0a0c10]">
      <aside className="fixed left-0 top-0 flex h-full w-64 flex-col border-r border-white/5 bg-[#141820]/95 backdrop-blur-xl">
        <div className="border-b border-white/5 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 font-bold shadow-lg shadow-emerald-500/20">
              D
            </div>
            <span className="font-bold tracking-tight">Divulga Top</span>
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 ${
                pathname === item.href
                  ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30"
                  : "text-slate-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-white/5 p-4">
          <a href="/" target="_blank" className="mb-2 block text-xs text-emerald-400 hover:underline">
            Ver vitrine →
          </a>
          <button onClick={logout} className="text-xs text-slate-500 hover:text-red-400">
            Sair
          </button>
        </div>
      </aside>
      <main className="ml-64 flex-1 p-8">{children}</main>
    </div>
  );
}
