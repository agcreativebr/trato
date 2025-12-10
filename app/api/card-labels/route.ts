import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { dispatchAutomationForEvent } from "@/lib/automation/engine";

export async function POST(req: NextRequest) {
  const supabase = getSupabaseServerClient();
  const body = await req.json();
  const { card_id, label_id, op } = body ?? {};
  if (!card_id || !label_id || !op)
    return NextResponse.json(
      { error: "card_id, label_id e op são obrigatórios" },
      { status: 422 }
    );
  // obter board_id (para automations)
  const { data: c } = await supabase
    .from("cards")
    .select("id, board_id")
    .eq("id", card_id)
    .single();
  if (op === "add") {
    await supabase.from("card_labels").insert({ card_id, label_id });
    try {
      await dispatchAutomationForEvent({
        type: "label.added",
        board_id: c?.board_id,
        card_id,
      } as any);
    } catch {}
  } else if (op === "remove") {
    await supabase.from("card_labels").delete().match({ card_id, label_id });
    try {
      await dispatchAutomationForEvent({
        type: "label.removed",
        board_id: c?.board_id,
        card_id,
      } as any);
    } catch {}
  } else {
    return NextResponse.json({ error: "op inválida" }, { status: 422 });
  }
  return NextResponse.json({ ok: true });
}


