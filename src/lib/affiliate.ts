import type { Platform } from "./types";

export function detectPlatform(url: string): Platform | null {
  const lower = url.toLowerCase();
  if (
    lower.includes("amazon.") ||
    lower.includes("amzn.to") ||
    lower.includes("amzn.eu") ||
    lower.includes("a.co/")
  )
    return "amazon";
  if (
    lower.includes("mercadolivre.") ||
    lower.includes("mercadolibre.") ||
    lower.includes("ml.com.br") ||
    lower.includes("produto.mercadolivre")
  )
    return "mercado_livre";
  if (lower.includes("shopee.") || lower.includes("shp.ee") || lower.includes("s.shopee.")) return "shopee";
  return null;
}

export function applyAffiliateId(url: string, platform: Platform, affiliateId: string): string {
  if (!affiliateId.trim()) return url;

  try {
    const parsed = new URL(url);

    switch (platform) {
      case "amazon": {
        parsed.searchParams.set("tag", affiliateId.trim());
        return parsed.toString();
      }
      case "mercado_livre": {
        const id = affiliateId.trim();
        parsed.searchParams.set("matt_tool", id);
        parsed.searchParams.set("matt_word", id);
        parsed.searchParams.set("utm_source", "affiliate");
        parsed.searchParams.set("utm_medium", "affiliate");
        return parsed.toString();
      }
      case "shopee": {
        const id = affiliateId.trim();
        parsed.searchParams.set("utm_source", `an_${id}`);
        parsed.searchParams.set("utm_medium", "affiliates");
        parsed.searchParams.set("utm_campaign", id);
        parsed.searchParams.set("sub_id", id);
        return parsed.toString();
      }
      default:
        return url;
    }
  } catch {
    return url;
  }
}

export function platformLabel(platform: Platform): string {
  const labels: Record<Platform, string> = {
    mercado_livre: "Mercado Livre",
    amazon: "Amazon",
    shopee: "Shopee",
  };
  return labels[platform];
}

export function platformColor(platform: Platform): string {
  const colors: Record<Platform, string> = {
    mercado_livre: "bg-yellow-500",
    amazon: "bg-orange-500",
    shopee: "bg-orange-600",
  };
  return colors[platform];
}
