import VitrinePage from "@/components/VitrinePage";
import type { Platform } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: { platform?: string };
}) {
  const platform = searchParams.platform as Platform | undefined;
  return <VitrinePage platform={platform} />;
}
