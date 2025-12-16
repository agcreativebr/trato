import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { dispatchAutomationForEvent } from "@/lib/automation/engine";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  const supabase = getSupabaseServerClient();
  const body = await req.json();
  const { id, list_id, position } = body ?? {};
  if (!id || !list_id || typeof position !== "number")
    return NextResponse.json(
      { error: "id, list_id e position são obrigatórios" },
      { status: 422 }
    );
  // precisamos do card atual para saber board_id e from_list_id
  const { data: before } = await supabase
    .from("cards")
    .select("id, list_id, board_id")
    .eq("id", id)
    .single();
  const { data, error } = await supabase
    .from("cards")
    .update({ list_id, position })
    .eq("id", id)
    .select("*")
    .single();
  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });
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
  await supabase.from("card_history").insert({
    card_id: data.id,
    action: "moved",
    actor_id,
    payload: { list_id, position },
  });
  // dispara automações do tipo 'event' para card.moved
  try {
    await dispatchAutomationForEvent({
      type: "card.moved",
      board_id: (before as any)?.board_id ?? data.board_id,
      card_id: data.id,
      from_list_id: (before as any)?.list_id ?? null,
      to_list_id: list_id,
    });
  } catch {}
  return NextResponse.json({ data });
}
