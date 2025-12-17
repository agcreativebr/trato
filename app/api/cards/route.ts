import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { dispatchAutomationForEvent } from "@/lib/automation/engine";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  const supabase = getSupabaseServerClient();
  const body = await req.json();
  const { title, board_id, list_id, position, description, due_date } =
    body ?? {};
  if (!title || !board_id || !list_id || typeof position !== "number")
    return NextResponse.json(
      { error: "title, board_id, list_id e position são obrigatórios" },
      { status: 422 }
    );
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
  const insert = {
    title,
    board_id,
    list_id,
    position,
    description: description ?? null,
    due_date: due_date ?? null,
  };
  const { data, error } = await supabase
    .from("cards")
    .insert(insert)
    .select("*")
    .single();
  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });
  // history
  await supabase.from("card_history").insert({
    card_id: data.id,
    action: "created",
    actor_id,
    payload: insert,
  });
  // automations: card.created
  try {
    await dispatchAutomationForEvent({
      type: "card.created",
      board_id: data.board_id,
      card_id: data.id,
      list_id: data.list_id,
    });
  } catch {}
  return NextResponse.json({ data });
}

export async function PATCH(req: NextRequest) {
  const supabase = getSupabaseServerClient();
  const body = await req.json();
  const { id, ...rest } = body ?? {};
  if (!id)
    return NextResponse.json({ error: "id é obrigatório" }, { status: 422 });
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
  // estado anterior
  const { data: before } = await supabase.from("cards").select("*").eq("id", id).single();
  const { data, error } = await supabase
    .from("cards")
    .update(rest)
    .eq("id", id)
    .select("*")
    .single();
  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });
  await supabase.from("card_history").insert({
    card_id: data.id,
    action: "updated",
    actor_id,
    payload: { before, after: rest },
  });
  return NextResponse.json({ data });
}
