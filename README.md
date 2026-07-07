# Divulga Top — Sistema de Vitrine de Ofertas

Site agregador de ofertas com painel admin, gestão de IDs de afiliado e importação automática de produtos (Mercado Livre, Amazon, Shopee).

## URLs

- **Produção (Vercel):** https://divulga-top-mu.vercel.app
- **Domínio cliente:** https://divulga.top (requer DNS apontando para Vercel)
- **Admin:** https://divulga-top-mu.vercel.app/admin

## Login Admin

- **Email:** betobrinco@gmail.com
- **Senha:** divulga2026

## Funcionalidades

1. **Vitrine pública** — grid 4 colunas, botão "Ver Oferta", filtros por plataforma
2. **3 sites/vitrines** — Divulga Top, Ofertas BR, Achadinhos (`/s/ofertas`, `/s/achadinhos`)
3. **Gerar Promoção** — cole até 30 links, busca automática de nome/preço/imagem
4. **Minhas Afiliações** — IDs de afiliado por plataforma, aplicados automaticamente
5. **Meus Sites** — editar nome e logo de cada vitrine

## Desenvolvimento Local

```bash
npm install
npm run dev
```

Acesse http://localhost:3000

## Deploy

### Vercel (atual)

1. **Configure storage** (required — without this, affiliate IDs and products reset on every request):
   - Vercel Dashboard → Storage → Create **Blob** store → Connect to project
   - This auto-sets `BLOB_READ_WRITE_TOKEN` in environment variables

2. **Optional env vars** (improve Shopee scraping reliability):
   - `SCRAPER_API_KEY` — [ScraperAPI](https://www.scraperapi.com/) free tier (1000 req/month)
   - `SHOPEE_AFFILIATE_APP_ID` + `SHOPEE_AFFILIATE_SECRET` — from [Shopee Affiliate Open API](https://affiliate.shopee.com.br/)

3. Deploy:

```bash
vercel deploy --prod
```

### Domínio divulga.top

No painel Hostinger/DNS do cliente, altere:

- **Tipo A** `@` → `76.76.21.21` (Vercel)
- **CNAME** `www` → `cname.vercel-dns.com`

Ou no Vercel Dashboard → Settings → Domains → adicionar `divulga.top`

## Estrutura

```
src/
├── app/
│   ├── page.tsx              # Vitrine principal
│   ├── s/[slug]/page.tsx     # Vitrines adicionais
│   ├── admin/                # Painel administrativo
│   └── api/                  # APIs REST
├── components/               # UI components
└── lib/
    ├── db.ts                 # Armazenamento (JSON local / Vercel Blob)
    ├── scraper.ts            # Scraping de produtos
    └── affiliate.ts          # IDs de afiliado
```

## Cliente — Passo a Passo

1. Acesse `/admin` e faça login
2. Vá em **Minhas Afiliações** e configure seus IDs (ML, Amazon, Shopee)
3. Vá em **Gerar Promoção**, cole links de produtos e clique em Gerar
4. Os produtos aparecem automaticamente na vitrine com seu ID de afiliado
5. Em **Meus Sites**, personalize nome e logo das 3 vitrines
