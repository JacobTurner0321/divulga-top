import VitrinePage from "@/components/VitrinePage";
import type { Platform } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SitePage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { platform?: string };
}) {
  const platform = searchParams.platform as Platform | undefined;
  return <VitrinePage slug={params.slug} platform={platform} />;
}
