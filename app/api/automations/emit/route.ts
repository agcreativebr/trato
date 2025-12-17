import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { dispatchAutomationForEvent } from "@/lib/automation/engine";
import { cookies } from "next/headers";

// POST { type: string, card_id: string, payload?: any }
export async function POST(req: NextRequest) {
  const supabase = getSupabaseServerClient();
  const body = await req.json();
  const { type, card_id, payload } = body ?? {};
  if (!type || !card_id) {
    return NextResponse.json(
      { error: "type e card_id são obrigatórios" },
      { status: 422 }
    );
  }
  const { data: card, error } = await supabase
    .from("cards")
    .select("id, board_id, list_id")
    .eq("id", card_id)
    .single();
  if (error || !card) {
    return NextResponse.json({ error: "Cartão não encontrado" }, { status: 404 });
  }
  try {
    // tenta identificar o usuário que originou o evento (se houver sessão)
    let actor_id: string | null = null;
    try {
      const token = cookies().get("sb-access-token")?.value;
      if (token) {
        const { data: authUser } = await supabase.auth.getUser(token);
        actor_id = authUser?.user?.id ?? null;
      }
    } catch {}
    // registra no histórico para alguns eventos genéricos
    try {
      if (["attachment.added","cover.changed","comment.posted","card.archived","card.restored","card.deleted"].includes(type)) {
        await supabase.from("card_history").insert({
          card_id: card.id,
          action: type,
          actor_id,
          payload: payload ?? null
        });
      }
    } catch {}
    const triggered = await dispatchAutomationForEvent({
      type,
      board_id: card.board_id,
      card_id: card.id,
      list_id: card.list_id,
      actor_id,
      ...(payload ?? {}),
    } as any);
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}


