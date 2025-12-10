import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  const supabase = getSupabaseServerClient();
  const { searchParams } = new URL(req.url);
  const boardId = searchParams.get("board_id");
  const { data, error } = await supabase
    .from("automations")
    .select("*")
    .match(boardId ? { board_id: boardId } : {})
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const supabase = getSupabaseServerClient();
  const body = await req.json();
  const {
    board_id,
    name,
    enabled = true,
    trigger_type,
    trigger_config,
    conditions = [],
    actions = [],
  } = body ?? {};
  if (!board_id || !name || !trigger_type) {
    return NextResponse.json(
      { error: "board_id, name e trigger_type são obrigatórios" },
      { status: 422 }
    );
  }
  const { data, error } = await supabase
    .from("automations")
    .insert({
      board_id,
      name,
      enabled,
      trigger_type,
      trigger_config,
      conditions,
      actions,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}

export async function PATCH(req: NextRequest) {
  const supabase = getSupabaseServerClient();
  const body = await req.json();
  const { id, ...update } = body ?? {};
  if (!id) return NextResponse.json({ error: "id é obrigatório" }, { status: 422 });
  const { data, error } = await supabase
    .from("automations")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}

export async function DELETE(req: NextRequest) {
  const supabase = getSupabaseServerClient();
  const body = await req.json();
  const { id } = body ?? {};
  if (!id) return NextResponse.json({ error: "id é obrigatório" }, { status: 422 });
  const { error } = await supabase.from("automations").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}


