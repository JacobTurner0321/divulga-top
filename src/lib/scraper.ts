import * as cheerio from "cheerio";
import type { Platform } from "./types";
import { detectPlatform } from "./affiliate";
import { isValidProductTitle } from "./validate";
import { scrapeShopeeProduct, parseShopeeIds, canonicalShopeeUrl } from "./shopee";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function proxyFetch(url: string, init?: RequestInit, render = false): Promise<Response> {
  const key = process.env.SCRAPER_API_KEY;
  if (key) {
    const params = new URLSearchParams({
      api_key: key,
      url,
      country_code: "br",
    });
    if (render) params.set("render", "true");
    return fetch(`https://api.scraperapi.com?${params}`, init);
  }
  return fetch(url, init);
}

export interface ScrapedProduct {
  title: string;
  image_url: string | null;
  price: number | null;
  original_price: number | null;
  discount_percent: number | null;
  platform: Platform;
  source_url: string;
}

function parsePrice(text: string | undefined | null): number | null {
  if (!text) return null;
  const cleaned = text.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function isValidTitle(title: string | undefined | null): boolean {
  return isValidProductTitle(title);
}

function extractJsonLd(html: string) {
  const $ = cheerio.load(html);
  const scripts = $('script[type="application/ld+json"]');
  for (let i = 0; i < scripts.length; i++) {
    try {
      const data = JSON.parse($(scripts[i]).html() || "");
      if (data["@type"] === "Product" || data.name) return data;
      if (Array.isArray(data)) {
        const product = data.find((d: { "@type"?: string }) => d["@type"] === "Product");
        if (product) return product;
      }
      if (data["@graph"]) {
        const product = data["@graph"].find((d: { "@type"?: string }) => d["@type"] === "Product");
        if (product) return product;
      }
    } catch {
      /* continue */
    }
  }
  return null;
}

async function resolveRedirects(url: string): Promise<string> {
  try {
    const res = await proxyFetch(url, {
      method: "GET",
      redirect: "follow",
      headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
    });
    return res.url || url;
  } catch {
    return url;
  }
}

async function fetchMercadoLivreItem(url: string): Promise<Partial<ScrapedProduct>> {
  const patterns = [/MLB-?(\d+)/i, /MLB(\d+)/i, /\/p\/MLB(\d+)/i, /wid=MLB(\d+)/i];

  for (const pattern of patterns) {
    const idMatch = url.match(pattern);
    if (idMatch) {
      const itemId = `MLB${idMatch[1]}`;
      try {
        const res = await proxyFetch(`https://api.mercadolibre.com/items/${itemId}`, {
          headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
        });
        if (res.ok) {
          const data = await res.json();
          const price = data.price as number;
          const original = data.original_price as number | null;
          return {
            title: data.title as string,
            image_url:
              data.pictures?.[0]?.secure_url ||
              data.pictures?.[0]?.url ||
              data.thumbnail?.replace("-I.jpg", "-O.jpg") ||
              null,
            price,
            original_price: original,
            discount_percent: original && price ? Math.round(((original - price) / original) * 100) : null,
          };
        }
      } catch {
        /* try next */
      }
    }
  }
  return {};
}

async function fetchAmazonItem(url: string): Promise<Partial<ScrapedProduct>> {
  const asinMatch = url.match(/\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})/i);
  if (!asinMatch) return {};

  try {
    const res = await proxyFetch(
      url,
      {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "pt-BR,pt;q=0.9",
        },
        redirect: "follow",
      },
      Boolean(process.env.SCRAPER_API_KEY)
    );
    if (!res.ok) return {};

    const html = await res.text();
    const $ = cheerio.load(html);

    const title =
      $("#productTitle").text().trim() ||
      $('meta[property="og:title"]').attr("content")?.replace(/Amazon\.com\.br:?/i, "").trim() ||
      "";

    const image_url =
      $("#landingImage").attr("src") ||
      $("#imgTagWrapperId img").attr("src") ||
      $('meta[property="og:image"]').attr("content") ||
      null;

    const price = parsePrice($(".a-price-whole").first().text());
    const original_price = parsePrice($(".a-text-price .a-offscreen").first().text());

    return {
      title,
      image_url,
      price,
      original_price,
      discount_percent:
        original_price && price ? Math.round(((original_price - price) / original_price) * 100) : null,
    };
  } catch {
    return {};
  }
}

async function scrapeHtml(url: string, platform: Platform): Promise<Partial<ScrapedProduct>> {
  const res = await proxyFetch(
    url,
    {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
      },
      redirect: "follow",
    },
    Boolean(process.env.SCRAPER_API_KEY)
  );

  if (!res.ok) throw new Error(`Não foi possível acessar o link (HTTP ${res.status})`);

  const html = await res.text();
  const $ = cheerio.load(html);
  const jsonLd = extractJsonLd(html);

  let title =
    jsonLd?.name ||
    $('meta[property="og:title"]').attr("content") ||
    $('meta[name="twitter:title"]').attr("content") ||
    $("title").text().trim() ||
    "";

  title = title.replace(/\s*[-|].*(Amazon|Shopee|Mercado Livre|MercadoLivre).*$/i, "").trim();

  const image_url =
    jsonLd?.image?.[0] ||
    jsonLd?.image ||
    $('meta[property="og:image"]').attr("content") ||
    $('meta[name="twitter:image"]').attr("content") ||
    null;

  let price: number | null = null;
  let original_price: number | null = null;

  if (jsonLd?.offers) {
    const offers = Array.isArray(jsonLd.offers) ? jsonLd.offers[0] : jsonLd.offers;
    price = parsePrice(String(offers?.price || offers?.lowPrice));
  }

  if (!price) {
    price =
      parsePrice($('meta[property="product:price:amount"]').attr("content")) ||
      parsePrice($('meta[property="og:price:amount"]').attr("content")) ||
      parsePrice($('[itemprop="price"]').attr("content")) ||
      parsePrice($('[data-testid="price-part"]').text()) ||
      parsePrice($(".andes-money-amount__fraction").first().text());
  }

  if (platform === "mercado_livre" && !price) {
    original_price = parsePrice($("s.andes-money-amount__fraction").first().text());
  }

  const discount_percent =
    original_price && price ? Math.round(((original_price - price) / original_price) * 100) : null;

  return { title, image_url, price, original_price, discount_percent };
}

export async function scrapeProduct(rawUrl: string): Promise<ScrapedProduct> {
  let normalized = rawUrl.trim();
  normalized = await resolveRedirects(normalized);

  const platform = detectPlatform(normalized);
  if (!platform) {
    throw new Error("Link não reconhecido. Use Mercado Livre, Amazon ou Shopee.");
  }

  if (platform === "shopee") {
    const ids = parseShopeeIds(normalized);
    const sourceUrl = ids ? canonicalShopeeUrl(ids) : normalized;
    const shopeeData = await scrapeShopeeProduct(normalized);

    return {
      title: shopeeData.title.trim(),
      image_url: shopeeData.image_url,
      price: shopeeData.price,
      original_price: shopeeData.original_price,
      discount_percent: shopeeData.discount_percent,
      platform,
      source_url: sourceUrl,
    };
  }

  let partial: Partial<ScrapedProduct> = {};

  if (platform === "mercado_livre") {
    partial = await fetchMercadoLivreItem(normalized);
  } else if (platform === "amazon") {
    partial = await fetchAmazonItem(normalized);
  }

  if (!isValidTitle(partial.title) || partial.price == null) {
    const htmlData = await scrapeHtml(normalized, platform);
    partial = {
      ...htmlData,
      ...partial,
      title: isValidTitle(partial.title) ? partial.title : htmlData.title,
      image_url: partial.image_url || htmlData.image_url,
      price: partial.price ?? htmlData.price,
      original_price: partial.original_price ?? htmlData.original_price,
    };
  }

  if (!isValidTitle(partial.title)) {
    throw new Error(
      "Não foi possível obter os dados do produto. Tente colar o link completo da página do produto."
    );
  }

  return {
    title: partial.title!.trim(),
    image_url: partial.image_url || null,
    price: partial.price ?? null,
    original_price: partial.original_price ?? null,
    discount_percent: partial.discount_percent ?? null,
    platform,
    source_url: normalized,
  };
}

export function parseMultipleUrls(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s,;"'<>]+/gi;
  const matches = text.match(urlRegex) || [];
  return Array.from(new Set(matches.map((u) => u.trim().replace(/[)\].,]+$/, ""))));
}
