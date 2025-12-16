import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { dispatchAutomationForEvent } from "@/lib/automation/engine";
import { cookies } from "next/headers";

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
  // identifica ator
  let actor_id: string | null = null;
  try {
    const hdr = req.headers.get("authorization") ?? req.headers.get("x-sb-access-token") ?? "";
    const tokenHeader = hdr?.toLowerCase().startsWith("bearer ") ? hdr.slice(7) : hdr || undefined;
    const token = tokenHeader ?? cookies().get("sb-access-token")?.value;
    if (token) {
      const { data: authUser } = await supabase.auth.getUser(token);
      actor_id = authUser?.user?.id ?? null;
    }
  } catch {}
  if (op === "add") {
    await supabase.from("card_labels").insert({ card_id, label_id });
    try {
      await supabase.from("card_history").insert({
        card_id,
        action: "label.added",
        actor_id,
        payload: { label_id }
      });
    } catch {}
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
      await supabase.from("card_history").insert({
        card_id,
        action: "label.removed",
        actor_id,
        payload: { label_id }
      });
    } catch {}
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


