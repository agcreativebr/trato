import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { dispatchAutomationForEvent, executeAutomation } from "@/lib/automation/engine";
import { cookies } from "next/headers";

// POST { card_id: string, start_date?: string|null, due_date?: string|null }
export async function POST(req: NextRequest) {
  const supabase = getSupabaseServerClient();
  const body = await req.json();
  const { card_id, start_date, due_date } = body ?? {};
  if (!card_id) {
    return NextResponse.json({ error: "card_id é obrigatório" }, { status: 422 });
  }
  // identifica ator uma vez para reaproveitar
  let actor_id: string | null = null;
  try {
    const token = cookies().get("sb-access-token")?.value;
    if (token) {
      const { data: authUser } = await supabase.auth.getUser(token);
      actor_id = authUser?.user?.id ?? null;
    }
  } catch {}
  const updates: any = {};
  if (typeof start_date !== "undefined") updates.start_date = start_date;
  if (typeof due_date !== "undefined") updates.due_date = due_date;
  if (!Object.keys(updates).length) {
    return NextResponse.json({ error: "Nada para atualizar" }, { status: 422 });
  }
  const { data: card } = await supabase
    .from("cards")
    .select("id, board_id, list_id")
    .eq("id", card_id)
    .single();
  const { error } = await supabase.from("cards").update(updates).eq("id", card_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  // registra histórico de alterações de datas
  try {
    await supabase.from("card_history").insert({
      card_id,
      action: "dates_updated",
      actor_id,
      payload: { start_date, due_date }
    });
  } catch {}
  let triggered = 0;
  let candidates = 0;
  try {
    if ("due_date" in updates) {
      const t = await dispatchAutomationForEvent({
        type: "due.changed",
        board_id: card!.board_id,
        card_id: card_id,
        list_id: card!.list_id,
        actor_id,
      } as any);
      triggered += t;
    }
    if ("start_date" in updates) {
      const t = await dispatchAutomationForEvent({
        type: "start.changed",
        board_id: card!.board_id,
        card_id: card_id,
        list_id: card!.list_id,
        actor_id,
      } as any);
      triggered += t;
    }
  } catch {}

  // Fallback defensivo: se nada foi disparado, tenta localizar regras manualmente
  if (triggered === 0) {
    const supabase2 = getSupabaseServerClient();
    const { data: autos } = await supabase2
      .from("automations")
      .select("*")
      .eq("board_id", card!.board_id)
      .eq("enabled", true)
      .eq("trigger_type", "event");
    const shouldFire: any[] = [];
    for (const a of autos ?? []) {
      const ev = a.trigger_config?.event;
      if ("due_date" in updates && ev === "due.changed") shouldFire.push(a);
      if ("start_date" in updates && ev === "start.changed") shouldFire.push(a);
    }
    candidates = shouldFire.length;
    for (const a of shouldFire) {
      await executeAutomation(a as any, {
        type: a.trigger_config?.event,
        board_id: card!.board_id,
        card_id: card_id,
        list_id: card!.list_id,
      } as any);
      triggered++;
    }
  }

  return NextResponse.json({ ok: true, triggered, candidates });
}


