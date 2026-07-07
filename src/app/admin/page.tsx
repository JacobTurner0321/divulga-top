import { redirect } from "next/navigation";
import { getSessionEmail } from "@/lib/auth";
import { getSites, getProducts, getAffiliates } from "@/lib/db";
import Link from "next/link";

export default async function AdminDashboard() {
  if (!(await getSessionEmail())) redirect("/admin/login");

  const sites = await getSites();
  const products = await getProducts();
  const affiliates = await getAffiliates(1);
  const configured = affiliates.filter((a) => a.affiliate_id).length;

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Olá! 👋</h1>
      <p className="mb-8 text-slate-400">Aqui está o resumo da sua conta</p>

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/5 bg-[#1a1d27] p-6">
          <p className="text-sm text-slate-400">Sites Configurados</p>
          <p className="text-3xl font-bold text-emerald-400">{sites.length}</p>
        </div>
        <div className="rounded-2xl border border-white/5 bg-[#1a1d27] p-6">
          <p className="text-sm text-slate-400">Produtos na Vitrine</p>
          <p className="text-3xl font-bold text-yellow-400">{products.length}</p>
        </div>
        <div className="rounded-2xl border border-white/5 bg-[#1a1d27] p-6">
          <p className="text-sm text-slate-400">Afiliações Configuradas</p>
          <p className="text-3xl font-bold text-blue-400">{configured}/3</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/admin/produtos"
          className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 transition hover:bg-emerald-500/20"
        >
          <h3 className="font-semibold text-emerald-400">Gerar Promoção</h3>
          <p className="mt-1 text-sm text-slate-400">Cole links e gere ofertas automaticamente</p>
        </Link>
        <Link
          href="/admin/afiliados"
          className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-6 transition hover:bg-blue-500/20"
        >
          <h3 className="font-semibold text-blue-400">Minhas Afiliações</h3>
          <p className="mt-1 text-sm text-slate-400">Configure seus IDs de Mercado Livre, Amazon e Shopee</p>
        </Link>
      </div>

      <div className="mt-8 rounded-2xl border border-white/5 bg-[#1a1d27] p-6">
        <h3 className="mb-4 font-semibold">Início Rápido</h3>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-400">
          <li>Configure seus IDs de afiliado em <strong className="text-white">Minhas Afiliações</strong></li>
          <li>Cole links de produtos em <strong className="text-white">Gerar Promoção</strong></li>
          <li>Os produtos aparecem automaticamente na vitrine com seu ID aplicado</li>
          <li>Use os 3 sites para diferentes nichos (links no menu Meus Sites)</li>
        </ol>
      </div>
    </div>
  );
}
