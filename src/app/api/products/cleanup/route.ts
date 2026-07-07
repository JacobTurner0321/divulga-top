import { NextResponse } from "next/server";
import { getSessionEmail } from "@/lib/auth";
import { removeInvalidProducts } from "@/lib/db";

export async function POST() {
  if (!(await getSessionEmail())) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const removed = await removeInvalidProducts();
    return NextResponse.json({ ok: true, removed });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao limpar produtos" },
      { status: 500 }
    );
  }
}
