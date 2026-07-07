export type Platform = "mercado_livre" | "amazon" | "shopee";

export interface Site {
  id: number;
  name: string;
  slug: string;
  logo_url: string | null;
  active: number;
}

export interface Product {
  id: number;
  site_id: number;
  title: string;
  image_url: string | null;
  price: number | null;
  original_price: number | null;
  discount_percent: number | null;
  platform: Platform;
  source_url: string;
  affiliate_url: string;
  active: number;
  created_at: string;
}

export interface AffiliateConfig {
  id: number;
  site_id: number;
  platform: Platform;
  affiliate_id: string;
}
