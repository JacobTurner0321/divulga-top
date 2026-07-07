export function isValidProductTitle(title: string | undefined | null): boolean {
  if (!title || title.trim().length < 4) return false;
  const t = title.trim().toLowerCase();
  if (t.includes("shopee__")) return false;
  if (t.includes("__domain")) return false;
  if (t === "shopee" || t === "shopee brasil") return false;
  if (t.startsWith("shopee.com")) return false;
  if (/^https?:\/\//.test(t)) return false;
  if (/^\d+$/.test(t)) return false;
  return true;
}
