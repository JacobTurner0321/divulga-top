import * as cheerio from "cheerio";
import crypto from "crypto";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// Shopee serves full SSR product pages to social-media crawlers (og tags + body HTML).
const SOCIAL_CRAWLER_AGENTS = [
  "facebookexternalhit/1.1",
  "WhatsApp/2.23.20.0",
  "TelegramBot (like TwitterBot)",
  "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
];

export interface ShopeeIds {
  shopId: string;
  itemId: string;
}

export interface ShopeeProductData {
  title: string;
  image_url: string | null;
  price: number | null;
  original_price: number | null;
  discount_percent: number | null;
}

export interface ShopeeApiCredentials {
  appId: string;
  secret: string;
}

function parsePrice(text: string | undefined | null): number | null {
  if (!text) return null;
  const cleaned = text.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function shopeeImageUrl(imageId: string | null | undefined): string | null {
  if (!imageId) return null;
  if (imageId.startsWith("http")) return imageId;
  return `https://cf.shopee.com.br/file/${imageId}`;
}

function shopeePrice(raw: number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  return raw >= 100000 ? raw / 100000 : raw;
}

export function parseShopeeIds(url: string): ShopeeIds | null {
  const patterns: { regex: RegExp; shop: number; item: number }[] = [
    { regex: /shopee\.com\.br\/[^/?#]+-i\.(\d+)\.(\d+)/i, shop: 1, item: 2 },
    { regex: /shopee\.com\.br\/product\/(\d+)\/(\d+)/i, shop: 1, item: 2 },
    { regex: /shopee\.com\.br\/[^/?#]+\/(\d+)\/(\d+)/i, shop: 1, item: 2 },
    { regex: /[?&]shopid=(\d+).*?[&]itemid=(\d+)/i, shop: 1, item: 2 },
    { regex: /[?&]itemid=(\d+).*?[&]shopid=(\d+)/i, shop: 2, item: 1 },
  ];

  for (const { regex, shop, item } of patterns) {
    const match = url.match(regex);
    if (match) {
      return { shopId: match[shop], itemId: match[item] };
    }
  }
  return null;
}

export function canonicalShopeeUrl(ids: ShopeeIds): string {
  return `https://shopee.com.br/product/${ids.shopId}/${ids.itemId}`;
}

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

/** Direct fetch — never route social-crawler requests through ScraperAPI. */
async function directFetch(url: string, userAgent: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": userAgent,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "pt-BR,pt;q=0.9",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(25000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    if (html.includes('"error":90309999') || html.length < 200) return null;
    return html;
  } catch {
    return null;
  }
}

async function fetchHtmlViaScraperApi(url: string, userAgent: string): Promise<string | null> {
  const key = process.env.SCRAPER_API_KEY;
  if (!key) return null;

  try {
    const params = new URLSearchParams({
      api_key: key,
      url,
      country_code: "br",
      render: "true",
    });
    const res = await fetch(`https://api.scraperapi.com?${params}`, {
      headers: { "User-Agent": userAgent },
      signal: AbortSignal.timeout(55000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    if (html.includes('"error":90309999') || html.length < 200) return null;
    return html;
  } catch {
    return null;
  }
}

export async function resolveShopeeSlugUrl(url: string): Promise<string> {
  for (const agent of SOCIAL_CRAWLER_AGENTS) {
    try {
      const res = await fetch(url, {
        method: "GET",
        redirect: "follow",
        headers: { "User-Agent": agent, Accept: "text/html" },
        signal: AbortSignal.timeout(15000),
      });
      if (res.url && res.url.includes("shopee.com.br")) return res.url;
    } catch {
      /* try next agent */
    }
  }
  return url;
}

function mapShopeeItem(item: Record<string, unknown>): ShopeeProductData | null {
  const name = (item.name || item.title) as string | undefined;
  if (!name?.trim()) return null;

  const price = shopeePrice((item.price ?? item.price_min) as number | undefined);
  const original = shopeePrice(
    (item.price_before_discount ?? item.price_strike ?? item.price_max) as number | undefined
  );

  return {
    title: name.trim(),
    image_url: shopeeImageUrl((item.image || (item.images as string[] | undefined)?.[0]) as string),
    price,
    original_price: original,
    discount_percent:
      original && price ? Math.round(((original - price) / original) * 100) : null,
  };
}

function extractFromApiJson(dataFromJson: Record<string, unknown>): ShopeeProductData | null {
  const item =
    (dataFromJson?.data as Record<string, unknown> | undefined)?.item ||
    (dataFromJson?.data as Record<string, unknown> | undefined) ||
    dataFromJson?.item;

  if (!item || typeof item !== "object") return null;
  return mapShopeeItem(item as Record<string, unknown>);
}

async function fetchShopeeApiEndpoint(apiUrl: string, referer: string): Promise<ShopeeProductData | null> {
  try {
    const res = await proxyFetch(apiUrl, {
      headers: {
        "User-Agent": USER_AGENT,
        "Accept-Encoding": "gzip, deflate, br",
        Accept: "application/json",
        Referer: referer,
        "Accept-Language": "pt-BR,pt;q=0.9",
        "x-api-source": "pc",
        "x-shopee-language": "pt-BR",
        "x-requested-with": "XMLHttpRequest",
      },
    });
    if (!res.ok) return null;

    const json = await res.json();
    if (json?.error) return null;
    return extractFromApiJson(json);
  } catch {
    return null;
  }
}

export async function fetchShopeeFromApi(url: string, ids: ShopeeIds): Promise<ShopeeProductData | null> {
  const referer = canonicalShopeeUrl(ids);
  const endpoints = [
    `https://shopee.com.br/api/v4/pdp/get_pc?item_id=${ids.itemId}&shop_id=${ids.shopId}&tz_offset_in_minutes=-180&detail_level=0`,
    `https://shopee.com.br/api/v4/item/get?itemid=${ids.itemId}&shopid=${ids.shopId}`,
    `https://shopee.com.br/api/v2/item/get?itemid=${ids.itemId}&shopid=${ids.shopId}`,
  ];

  for (const endpoint of endpoints) {
    const data = await fetchShopeeApiEndpoint(endpoint, referer);
    if (data?.title) return data;
  }
  return null;
}

function cleanShopeeTitle(title: string): string {
  return title
    .replace(/\s*\|\s*Shopee(\s+Brasil)?\s*$/i, "")
    .replace(/\s*[-|]\s*Shopee(\s+Brasil)?\s*$/i, "")
    .trim();
}

function isGenericShopeeTitle(title: string): boolean {
  const t = title.trim().toLowerCase();
  return !t || t.includes("shopee__") || t === "shopee" || t === "shopee brasil";
}

function extractMetaRegex(html: string): { title: string; image: string | null } | null {
  const ogTitle =
    html.match(/property=["']og:title["'][^>]*content=["']([^"']+)["']/i)?.[1] ||
    html.match(/content=["']([^"']+)["'][^>]*property=["']og:title["']/i)?.[1] ||
    html.match(/<h1[^>]*class=["'][^"']*dMAFry[^"']*["'][^>]*>([^<]+)</i)?.[1]?.trim() ||
    html.match(/<h1[^>]*>([^<]{4,})</i)?.[1]?.trim();

  if (!ogTitle || isGenericShopeeTitle(ogTitle)) return null;

  const ogImage =
    html.match(/property=["']og:image["'][^>]*content=["']([^"']+)["']/i)?.[1] ||
    html.match(/content=["']([^"']+)["'][^>]*property=["']og:image["']/i)?.[1] ||
    html.match(/elementtiming=["']shopee:heroComponentPaint["'][^>]*src=["']([^"']+)["']/i)?.[1] ||
    html.match(/fetchPriority=["']high["'][^>]*src=["']([^"']+)["']/i)?.[1] ||
    null;

  return { title: cleanShopeeTitle(ogTitle), image: ogImage };
}

function pickShopeeImage($: cheerio.CheerioAPI): string | null {
  const hero =
    $('img[elementtiming="shopee:heroComponentPaint"]').attr("src") ||
    $('img[fetchpriority="high"]').attr("src") ||
    $("picture img").first().attr("src");

  const ogImage = $('meta[property="og:image"]').attr("content");
  if (hero) return hero;
  if (ogImage && !ogImage.includes("promo-dim")) return ogImage;
  return ogImage || $('meta[name="twitter:image"]').attr("content") || null;
}

function extractFromInitialState(html: string): ShopeeProductData | null {
  const marker = "window.__INITIAL_STATE__";
  const start = html.indexOf(marker);
  if (start === -1) return null;

  const jsonStart = html.indexOf("{", start);
  if (jsonStart === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = jsonStart; i < html.length; i++) {
    const ch = html[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        try {
          const state = JSON.parse(html.slice(jsonStart, i + 1));
          const item =
            state?.item?.item ||
            state?.itemDetail?.item ||
            state?.product?.item ||
            state?.product;
          if (item && typeof item === "object") {
            return mapShopeeItem(item);
          }
        } catch {
          return null;
        }
        return null;
      }
    }
  }
  return null;
}

function extractFromHtml(html: string): ShopeeProductData | null {
  const fromState = extractFromInitialState(html);
  if (fromState?.title) return fromState;

  const fromRegex = extractMetaRegex(html);
  if (fromRegex) {
    return {
      title: fromRegex.title,
      image_url: fromRegex.image,
      price: null,
      original_price: null,
      discount_percent: null,
    };
  }

  const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (nextDataMatch) {
    try {
      const nextData = JSON.parse(nextDataMatch[1]);
      const item = nextData?.props?.pageProps?.item || nextData?.props?.pageProps?.data?.item;
      if (item && typeof item === "object") {
        const mapped = mapShopeeItem(item);
        if (mapped) return mapped;
      }
    } catch {
      /* continue */
    }
  }

  const $ = cheerio.load(html);
  const title =
    $("h1.dMAFry").first().text().trim() ||
    $("h1").first().text().trim() ||
    $('meta[property="og:title"]').attr("content")?.trim() ||
    $('meta[name="twitter:title"]').attr("content")?.trim() ||
    "";

  if (isGenericShopeeTitle(title)) return null;

  const image_url = pickShopeeImage($);

  const priceText =
    $('meta[property="product:price:amount"]').attr("content") ||
    $('meta[property="og:price:amount"]').attr("content") ||
    $('[itemprop="price"]').attr("content") ||
    "";

  const price = parsePrice(priceText);

  return {
    title: cleanShopeeTitle(title),
    image_url,
    price,
    original_price: null,
    discount_percent: null,
  };
}

export async function fetchShopeeFromHtml(url: string): Promise<ShopeeProductData | null> {
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
    if (!res.ok) return null;
    const html = await res.text();
    return extractFromHtml(html);
  } catch {
    return null;
  }
}

async function fetchShopeePageWithAgent(url: string, userAgent: string): Promise<ShopeeProductData | null> {
  let html = await directFetch(url, userAgent);
  if (!html) html = await fetchHtmlViaScraperApi(url, userAgent);
  if (!html) return null;
  return extractFromHtml(html);
}

export async function fetchShopeeFromSocialCrawler(urls: string[]): Promise<ShopeeProductData | null> {
  const uniqueUrls = [...new Set(urls.filter(Boolean))];

  for (const url of uniqueUrls) {
    for (const agent of SOCIAL_CRAWLER_AGENTS) {
      const data = await fetchShopeePageWithAgent(url, agent);
      if (data?.title && data.title.length >= 4 && !isGenericShopeeTitle(data.title)) {
        return data;
      }
    }
  }
  return null;
}

export async function fetchFromAffiliateApi(
  ids: ShopeeIds,
  credentials?: ShopeeApiCredentials | null
): Promise<ShopeeProductData | null> {
  const appId = credentials?.appId || process.env.SHOPEE_AFFILIATE_APP_ID;
  const secret = credentials?.secret || process.env.SHOPEE_AFFILIATE_SECRET;
  if (!appId || !secret) return null;

  const query = `{ productOfferV2(shopId:${ids.shopId}, itemId:${ids.itemId}, limit:1) { nodes { productName imageUrl priceMin priceMax priceDiscountRate productLink offerLink } } }`;
  const payload = JSON.stringify({ query });
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = crypto
    .createHash("sha256")
    .update(`${appId}${timestamp}${payload}${secret}`)
    .digest("hex");

  try {
    const res = await fetch("https://open-api.affiliate.shopee.com.br/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `SHA256 Credential=${appId},Timestamp=${timestamp},Signature=${signature}`,
      },
      body: payload,
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;

    const json = await res.json();
    const node = json?.data?.productOfferV2?.nodes?.[0];
    if (!node?.productName) return null;

    const price = parseFloat(String(node.priceMin)) || null;
    const discount = parseFloat(String(node.priceDiscountRate)) || 0;
    const original =
      price && discount > 0 ? Math.round((price / (1 - discount / 100)) * 100) / 100 : null;

    return {
      title: node.productName as string,
      image_url: (node.imageUrl as string) || null,
      price,
      original_price: original,
      discount_percent: discount > 0 ? Math.round(discount) : null,
    };
  } catch {
    return null;
  }
}

async function fetchShopeeWithBrowser(url: string): Promise<ShopeeProductData | null> {
  if (process.env.DISABLE_BROWSER_SCRAPE === "true") return null;

  try {
    const puppeteer = await import("puppeteer-core");
    const chromium = await import("@sparticuz/chromium-min");

    const isLocal = Boolean(process.env.CHROME_PATH);
    const packUrl =
      process.env.CHROMIUM_PACK_URL ||
      "https://github.com/Sparticuz/chromium/releases/download/v149.0.0/chromium-v149.0.0-pack.tar";

    const executablePath = isLocal
      ? process.env.CHROME_PATH!
      : process.env.VERCEL
        ? await chromium.default.executablePath(packUrl)
        : null;

    if (!executablePath) return null;

    const headlessType = isLocal ? true : "shell";
    const launchArgs = isLocal
      ? ["--no-sandbox", "--disable-setuid-sandbox"]
      : puppeteer.default.defaultArgs({ args: chromium.default.args, headless: headlessType });

    const browser = await puppeteer.default.launch({
      args: launchArgs,
      defaultViewport: { width: 1280, height: 800 },
      executablePath,
      headless: headlessType,
    });

    try {
      const page = await browser.newPage();
      await page.setUserAgent("facebookexternalhit/1.1");
      await page.goto(url, { waitUntil: "networkidle2", timeout: 45000 });

      await page
        .waitForFunction(
          () => {
            const title = document.querySelector("meta[property='og:title']")?.getAttribute("content");
            if (title && title.length > 5 && !title.toLowerCase().includes("shopee brasil")) return true;
            const h1 = document.querySelector("h1")?.textContent?.trim();
            return Boolean(h1 && h1.length > 4);
          },
          { timeout: 20000 }
        )
        .catch(() => null);

      const html = await page.content();
      return extractFromHtml(html);
    } finally {
      await browser.close();
    }
  } catch (err) {
    console.error("Shopee browser scrape failed:", err);
    return null;
  }
}

export async function scrapeShopeeProduct(
  resolvedUrl: string,
  credentials?: ShopeeApiCredentials | null
): Promise<ShopeeProductData> {
  const ids = parseShopeeIds(resolvedUrl);
  if (!ids) {
    throw new Error("Link Shopee inválido. Cole o link completo da página do produto.");
  }

  const canonical = canonicalShopeeUrl(ids);
  const slugUrl = await resolveShopeeSlugUrl(canonical);
  const urlsToTry = [...new Set([slugUrl, canonical, resolvedUrl])];

  const attempts: Array<() => Promise<ShopeeProductData | null>> = [
    () => fetchFromAffiliateApi(ids, credentials),
    () => fetchShopeeFromSocialCrawler(urlsToTry),
    () => fetchShopeeFromApi(canonical, ids),
    () => fetchShopeeFromHtml(canonical),
    () => fetchShopeeWithBrowser(slugUrl),
  ];

  for (const attempt of attempts) {
    const data = await attempt();
    if (data?.title && data.title.length >= 4 && !isGenericShopeeTitle(data.title)) {
      return data;
    }
  }

  throw new Error(
    "Não foi possível obter os dados do produto Shopee. Tente novamente em alguns minutos ou use o link completo da página."
  );
}
