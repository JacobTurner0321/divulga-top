import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    version: "2026-07-07-shopee-fix",
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "local",
    shopee_scraper: true,
  });
}
