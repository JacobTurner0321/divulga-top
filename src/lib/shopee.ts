import * as cheerio from "cheerio";
import crypto from "crypto";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

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

function extractFromHtml(html: string): ShopeeProductData | null {
  const initialStateMatch = html.match(
    /<script[^>]*>\s*window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?})\s*;<\/script>/
  );
  if (initialStateMatch) {
    try {
      const state = JSON.parse(initialStateMatch[1]);
      const item =
        state?.item?.item ||
        state?.itemDetail?.item ||
        state?.product?.item ||
        state?.product;
      if (item && typeof item === "object") {
        const mapped = mapShopeeItem(item);
        if (mapped) return mapped;
      }
    } catch {
      /* continue */
    }
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
    $('meta[property="og:title"]').attr("content")?.trim() ||
    $('meta[name="twitter:title"]').attr("content")?.trim() ||
    "";

  if (!title || title.toLowerCase().includes("shopee__") || title.toLowerCase() === "shopee brasil") {
    return null;
  }

  const image_url =
    $('meta[property="og:image"]').attr("content") ||
    $('meta[name="twitter:image"]').attr("content") ||
    null;

  const priceText =
    $('meta[property="product:price:amount"]').attr("content") ||
    $('meta[property="og:price:amount"]').attr("content") ||
    $('[itemprop="price"]').attr("content") ||
    "";

  const price = parsePrice(priceText);

  return {
    title: title.replace(/\s*[-|].*Shopee.*$/i, "").trim(),
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

async function fetchFromAffiliateApi(ids: ShopeeIds): Promise<ShopeeProductData | null> {
  const appId = process.env.SHOPEE_AFFILIATE_APP_ID;
  const secret = process.env.SHOPEE_AFFILIATE_SECRET;
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
      : await puppeteer.default.defaultArgs({ args: chromium.default.args, headless: headlessType });

    const browser = await puppeteer.default.launch({
      args: launchArgs,
      defaultViewport: { width: 1280, height: 800 },
      executablePath,
      headless: headlessType,
    });

    try {
      const page = await browser.newPage();
      await page.setUserAgent(USER_AGENT);
      await page.goto(url, { waitUntil: "networkidle2", timeout: 45000 });

      await page
        .waitForFunction(
          () => {
            const state = (window as unknown as { __INITIAL_STATE__?: { item?: { item?: { name?: string } } } })
              .__INITIAL_STATE__;
            if (state?.item?.item?.name) return true;
            const title = document.querySelector("meta[property='og:title']")?.getAttribute("content");
            return Boolean(title && title.length > 5 && !title.toLowerCase().includes("shopee brasil"));
          },
          { timeout: 20000 }
        )
        .catch(() => null);

      const data = await page.evaluate(() => {
        const state = (window as unknown as {
          __INITIAL_STATE__?: {
            item?: { item?: Record<string, unknown> };
            itemDetail?: { item?: Record<string, unknown> };
          };
        }).__INITIAL_STATE__;

        const item = state?.item?.item || state?.itemDetail?.item;
        if (item && typeof item === "object" && item.name) {
          const priceRaw = (item.price ?? item.price_min) as number | undefined;
          const originalRaw = (item.price_before_discount ?? item.price_strike) as number | undefined;
          const price = priceRaw != null ? (priceRaw >= 100000 ? priceRaw / 100000 : priceRaw) : null;
          const original =
            originalRaw != null ? (originalRaw >= 100000 ? originalRaw / 100000 : originalRaw) : null;
          const imageId = (item.image || (item.images as string[] | undefined)?.[0]) as string | undefined;

          return {
            title: String(item.name).trim(),
            image_url: imageId
              ? imageId.startsWith("http")
                ? imageId
                : `https://cf.shopee.com.br/file/${imageId}`
              : null,
            price,
            original_price: original,
            discount_percent:
              original && price ? Math.round(((original - price) / original) * 100) : null,
          };
        }

        const ogTitle = document.querySelector("meta[property='og:title']")?.getAttribute("content")?.trim();
        const ogImage = document.querySelector("meta[property='og:image']")?.getAttribute("content");
        if (ogTitle && !ogTitle.toLowerCase().includes("shopee brasil")) {
          return {
            title: ogTitle.replace(/\s*[-|].*Shopee.*$/i, "").trim(),
            image_url: ogImage || null,
            price: null,
            original_price: null,
            discount_percent: null,
          };
        }
        return null;
      });

      return data;
    } finally {
      await browser.close();
    }
  } catch (err) {
    console.error("Shopee browser scrape failed:", err);
    return null;
  }
}

export async function scrapeShopeeProduct(resolvedUrl: string): Promise<ShopeeProductData> {
  const ids = parseShopeeIds(resolvedUrl);
  if (!ids) {
    throw new Error("Link Shopee inválido. Cole o link completo da página do produto.");
  }

  const canonical = canonicalShopeeUrl(ids);
  const attempts: Array<() => Promise<ShopeeProductData | null>> = [
    () => fetchFromAffiliateApi(ids),
    () => fetchShopeeFromApi(canonical, ids),
    () => fetchShopeeFromHtml(canonical),
    () => fetchShopeeWithBrowser(canonical),
  ];

  for (const attempt of attempts) {
    const data = await attempt();
    if (data?.title && data.title.length >= 4 && !data.title.toLowerCase().includes("shopee__")) {
      return data;
    }
  }

  throw new Error(
    "Não foi possível obter os dados do produto Shopee. Tente novamente em alguns minutos ou use o link completo da página."
  );
}
