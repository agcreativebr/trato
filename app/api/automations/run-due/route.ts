import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { executeAutomation } from "@/lib/automation/engine";

// Este endpoint pode ser chamado por um cron (Vercel/Supabase).
// Ele procura automações trigger_type='due' e dispara conforme as janelas configuradas.
export async function GET(_req: NextRequest) {
  const supabase = getSupabaseServerClient();
  const now = new Date();
  const { data: autos, error } = await supabase
    .from("automations")
    .select("*")
    .eq("enabled", true)
    .eq("trigger_type", "due");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  let triggered = 0;
  for (const a of autos ?? []) {
    const cfg: any = a.trigger_config ?? {};
    const event = cfg?.event as string; // "due.approaching" | "due.past"
    const minutes = Number(cfg?.minutes ?? 0);
    if (!event || (event !== "due.approaching" && event !== "due.past")) continue;

    // busca cards do board
    const { data: cards } = await supabase
      .from("cards")
      .select("id, board_id, due_date, archived_at")
      .eq("board_id", a.board_id)
      .is("archived_at", null)
      .not("due_date", "is", null);

    for (const c of cards ?? []) {
      const dueMs = new Date(c.due_date as any).getTime();
      const diffMin = Math.round((dueMs - now.getTime()) / 60000);
      let match = false;
      if (event === "due.approaching") {
        match = diffMin >= 0 && diffMin <= minutes;
      } else if (event === "due.past") {
        match = diffMin <= 0 && Math.abs(diffMin) <= minutes;
      }
      if (!match) continue;

      // dedupe: se já rodou p/ este automation + card recentemente (12h), pula
      const since = new Date(now.getTime() - 12 * 60 * 60000).toISOString();
      const { data: runs } = await supabase
        .from("automation_runs")
        .select("id, created_at, payload")
        .eq("automation_id", a.id)
        .gte("created_at", since);
      const already = (runs ?? []).some((r: any) => (r.payload?.card_id ?? "") === c.id && (r.payload?.type ?? "") === event);
      if (already) continue;

      await executeAutomation(a as any, {
        type: event,
        board_id: c.board_id,
        card_id: c.id,
      } as any);
      triggered++;
    }
  }
  return NextResponse.json({ ok: true, triggered });
}


