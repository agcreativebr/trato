import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { dispatchAutomationForEvent } from "@/lib/automation/engine";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  const supabase = getSupabaseServerClient();
  const body = await req.json();
  const { item_id } = body ?? {};
  if (!item_id)
    return NextResponse.json({ error: "item_id é obrigatório" }, { status: 422 });
  const { data: item } = await supabase
    .from("checklist_items")
    .select("*")
    .eq("id", item_id)
    .single();
  if (!item)
    return NextResponse.json({ error: "Item não encontrado" }, { status: 404 });
  const updated = !item.done;
  await supabase.from("checklist_items").update({ done: updated }).eq("id", item_id);
  // verificar se checklist foi concluída
  const { data: all } = await supabase
    .from("checklist_items")
    .select("done")
    .eq("checklist_id", item.checklist_id);
  const completed = (all ?? []).length > 0 && (all ?? []).every((x: any) => x.done);
  if (completed) {
    // obter card_id
    const { data: cl } = await supabase
      .from("checklists")
      .select("card_id")
      .eq("id", item.checklist_id)
      .single();
    const { data: card } = await supabase
      .from("cards")
      .select("board_id")
      .eq("id", cl?.card_id)
      .single();
    // registra histórico do toggle e possível conclusão
    try {
      // identifica ator
      let actor_id: string | null = null;
      try {
        const token = cookies().get("sb-access-token")?.value;
        if (token) {
          const { data: authUser } = await supabase.auth.getUser(token);
          actor_id = authUser?.user?.id ?? null;
        }
      } catch {}
      await supabase.from("card_history").insert({
        card_id: cl?.card_id,
        action: "checklist.completed",
        actor_id,
        payload: { checklist_id: item.checklist_id }
      });
    } catch {}
    try {
      await dispatchAutomationForEvent({
        type: "checklist.completed",
        board_id: card?.board_id,
        card_id: cl?.card_id,
      } as any);
    } catch {}
  } else {
    // registro simples de toggle
    try {
      let actor_id: string | null = null;
      try {
        const token = cookies().get("sb-access-token")?.value;
        if (token) {
          const { data: authUser } = await supabase.auth.getUser(token);
          actor_id = authUser?.user?.id ?? null;
        }
      } catch {}
      await supabase.from("card_history").insert({
        card_id: item.card_id,
        action: "checklist.item_toggled",
        actor_id,
        payload: { item_id: item.id, done: updated }
      });
    } catch {}
  }
  return NextResponse.json({ ok: true, done: updated, checklistCompleted: completed });
}


