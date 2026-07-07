import "server-only";
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import { put, get } from "@vercel/blob";
import { Redis } from "@upstash/redis";
import type { Platform, Site, Product, AffiliateConfig } from "./types";
import { isValidProductTitle } from "./validate";

export type { Platform, Site, Product, AffiliateConfig } from "./types";

interface Store {
  admin_users: { id: number; email: string; password_hash: string }[];
  sites: Site[];
  affiliate_ids: AffiliateConfig[];
  products: Product[];
  nextProductId: number;
  nextAffiliateId: number;
}

const STORE_KEY = "divulga-store";
const BLOB_NAME = "divulga-store.json";
const LOCAL_PATH = path.join(process.cwd(), "data", "store.json");

function defaultStore(): Store {
  const hash = bcrypt.hashSync("divulga2026", 10);
  return {
    admin_users: [{ id: 1, email: "betobrinco@gmail.com", password_hash: hash }],
    sites: [
      { id: 1, name: "Divulga Top", slug: "default", logo_url: null, active: 1 },
      { id: 2, name: "Ofertas BR", slug: "ofertas", logo_url: null, active: 1 },
      { id: 3, name: "Achadinhos", slug: "achadinhos", logo_url: null, active: 1 },
    ],
    affiliate_ids: [1, 2, 3].flatMap((siteId) =>
      (["mercado_livre", "amazon", "shopee"] as Platform[]).map((platform, i) => ({
        id: (siteId - 1) * 3 + i + 1,
        site_id: siteId,
        platform,
        affiliate_id: "",
      }))
    ),
    products: [],
    nextProductId: 1,
    nextAffiliateId: 10,
  };
}

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

async function loadFromRedis(): Promise<Store | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const data = await redis.get<Store>(STORE_KEY);
    return data || null;
  } catch {
    return null;
  }
}

async function saveToRedis(store: Store) {
  const redis = getRedis();
  if (!redis) return false;
  await redis.set(STORE_KEY, store);
  return true;
}

async function loadFromBlob(): Promise<Store | null> {
  try {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    const options = { access: "private" as const, ...(token ? { token } : {}) };
    const response = await get(BLOB_NAME, options);
    if (!response?.stream) return null;
    const text = await new Response(response.stream as ReadableStream).text();
    if (!text.trim()) return null;
    return JSON.parse(text) as Store;
  } catch (err) {
    console.error("Blob load error:", err);
    return null;
  }
}

async function saveToBlob(store: Store): Promise<boolean> {
  try {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    await put(BLOB_NAME, JSON.stringify(store), {
      ...(token ? { token } : {}),
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
    });
    return true;
  } catch (err) {
    console.error("Blob save error:", err);
    return false;
  }
}

function loadLocal(): Store {
  if (!fs.existsSync(LOCAL_PATH)) {
    const store = defaultStore();
    fs.mkdirSync(path.dirname(LOCAL_PATH), { recursive: true });
    fs.writeFileSync(LOCAL_PATH, JSON.stringify(store, null, 2));
    return store;
  }
  return JSON.parse(fs.readFileSync(LOCAL_PATH, "utf-8")) as Store;
}

function saveLocal(store: Store) {
  fs.mkdirSync(path.dirname(LOCAL_PATH), { recursive: true });
  fs.writeFileSync(LOCAL_PATH, JSON.stringify(store, null, 2));
}

function normalizeStore(store: Store): { store: Store; changed: boolean } {
  let changed = false;

  const deduped: AffiliateConfig[] = [];
  for (const entry of store.affiliate_ids) {
    const idx = deduped.findIndex((a) => a.site_id === entry.site_id && a.platform === entry.platform);
    if (idx === -1) {
      deduped.push({ ...entry });
      continue;
    }
    const existing = deduped[idx];
    if (entry.affiliate_id && entry.affiliate_id !== existing.affiliate_id) {
      existing.affiliate_id = entry.affiliate_id;
      changed = true;
    }
  }
  if (deduped.length !== store.affiliate_ids.length) {
    store.affiliate_ids = deduped;
    changed = true;
  }

  const before = store.products.length;
  store.products = store.products.filter((p) => isValidProductTitle(p.title));
  if (store.products.length !== before) changed = true;

  return { store, changed };
}

async function loadStore(): Promise<Store> {
  let store: Store;
  if (process.env.VERCEL) {
    const fromRedis = await loadFromRedis();
    if (fromRedis) store = fromRedis;
    else {
      const fromBlob = await loadFromBlob();
      store = fromBlob || defaultStore();
    }
  } else {
    store = loadLocal();
  }

  const { store: normalized, changed } = normalizeStore(store);
  if (changed && process.env.VERCEL) {
    try {
      await persistStore(normalized);
    } catch {
      /* read-only path; write happens on admin actions */
    }
  } else if (changed) {
    saveLocal(normalized);
  }
  return normalized;
}

async function persistStore(store: Store): Promise<void> {
  if (process.env.VERCEL) {
    const savedRedis = await saveToRedis(store);
    if (savedRedis) return;

    const savedBlob = await saveToBlob(store);
    if (savedBlob) return;

    const hasBlob = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
    const hasRedis = Boolean(
      process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL
    );
    throw new Error(
      hasBlob || hasRedis
        ? "Falha ao salvar dados. Verifique a configuração do Blob/Redis no Vercel."
        : "Armazenamento não configurado. Adicione Vercel Blob ou Upstash Redis ao projeto."
    );
  }
  saveLocal(store);
}

export async function getStore(): Promise<Store> {
  return loadStore();
}

export async function getSites(activeOnly = false) {
  const store = await getStore();
  const sites = store.sites;
  return activeOnly ? sites.filter((s) => s.active === 1) : sites;
}

export async function getSiteBySlug(slug: string) {
  const store = await getStore();
  return store.sites.find((s) => s.slug === slug && s.active === 1);
}

export async function getSiteById(id: number) {
  const store = await getStore();
  return store.sites.find((s) => s.id === id);
}

export async function getAffiliates(siteId: number) {
  const store = await getStore();
  const byPlatform = new Map<Platform, AffiliateConfig>();
  for (const entry of store.affiliate_ids) {
    if (entry.site_id !== siteId) continue;
    const prev = byPlatform.get(entry.platform);
    if (!prev || (!prev.affiliate_id && entry.affiliate_id)) {
      byPlatform.set(entry.platform, entry);
    }
  }
  return Array.from(byPlatform.values());
}

export async function saveAffiliatesBatch(
  siteId: number,
  updates: { platform: Platform; affiliate_id: string }[]
) {
  const store = await getStore();
  for (const { platform, affiliate_id } of updates) {
    const existing = store.affiliate_ids.find((a) => a.site_id === siteId && a.platform === platform);
    if (existing) {
      existing.affiliate_id = affiliate_id.trim();
    } else {
      store.affiliate_ids.push({
        id: store.nextAffiliateId++,
        site_id: siteId,
        platform,
        affiliate_id: affiliate_id.trim(),
      });
    }
  }
  normalizeStore(store);
  await persistStore(store);
}

export async function upsertAffiliate(siteId: number, platform: Platform, affiliateId: string) {
  await saveAffiliatesBatch(siteId, [{ platform, affiliate_id: affiliateId }]);
}

export async function getProducts(siteId?: number, platform?: Platform) {
  const store = await getStore();
  let products = store.products.filter((p) => p.active === 1 && isValidProductTitle(p.title));
  if (siteId) products = products.filter((p) => p.site_id === siteId);
  if (platform) products = products.filter((p) => p.platform === platform);
  return products.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function removeInvalidProducts() {
  const store = await getStore();
  const before = store.products.length;
  store.products = store.products.filter((p) => isValidProductTitle(p.title));
  const removed = before - store.products.length;
  if (removed > 0) await persistStore(store);
  return removed;
}

export async function getAllProductsAdmin(siteId?: number) {
  const store = await getStore();
  let products = store.products;
  if (siteId) products = products.filter((p) => p.site_id === siteId);
  return products.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function insertProduct(data: Omit<Product, "id" | "created_at" | "active">) {
  const store = await getStore();
  const id = store.nextProductId++;
  const product: Product = {
    ...data,
    id,
    active: 1,
    created_at: new Date().toISOString(),
  };
  store.products.unshift(product);
  await persistStore(store);
  return id;
}

export async function updateProduct(
  id: number,
  data: Partial<Omit<Product, "id" | "created_at" | "active">>
) {
  const store = await getStore();
  const product = store.products.find((p) => p.id === id);
  if (!product) return false;
  Object.assign(product, data);
  await persistStore(store);
  return true;
}

export async function getProductById(id: number) {
  const store = await getStore();
  return store.products.find((p) => p.id === id);
}

export async function deleteProduct(id: number) {
  const store = await getStore();
  store.products = store.products.filter((p) => p.id !== id);
  await persistStore(store);
}

export async function toggleProduct(id: number, active: number) {
  const store = await getStore();
  const product = store.products.find((p) => p.id === id);
  if (product) product.active = active;
  await persistStore(store);
}

export async function updateSite(id: number, name: string, logo_url: string | null) {
  const store = await getStore();
  const site = store.sites.find((s) => s.id === id);
  if (site) {
    site.name = name;
    site.logo_url = logo_url;
  }
  await persistStore(store);
}

export async function getAdminByEmail(email: string) {
  const store = await getStore();
  return store.admin_users.find((u) => u.email === email);
}
