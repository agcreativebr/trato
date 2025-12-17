import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { cookies } from "next/headers";

export async function GET(req: NextRequest) {
  const supabase = getSupabaseServerClient();
  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get("workspaceId");
  if (!workspaceId)
    return NextResponse.json(
      { error: "workspaceId é obrigatório" },
      { status: 422 }
    );
  const { data, error } = await supabase
    .from("boards")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });
  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const supabase = getSupabaseServerClient();
  const body = await req.json();
  const { name, workspace_id } = body ?? {};
  if (!name || !workspace_id)
    return NextResponse.json(
      { error: "name e workspace_id são obrigatórios" },
      { status: 422 }
    );
  const { data, error } = await supabase
    .from("boards")
    .insert({ name, workspace_id })
    .select("*")
    .single();
  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}

export async function PATCH(req: NextRequest) {
  const supabase = getSupabaseServerClient();
  const body = await req.json();
  const { id, name } = body ?? {};
  if (!id)
    return NextResponse.json({ error: "id é obrigatório" }, { status: 422 });
  const { data: before } = await supabase.from("boards").select("*").eq("id", id).single();
  const update: Record<string, any> = {};
  if (typeof name === "string") update.name = name;
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nada para atualizar" }, { status: 422 });
  }
  const { data, error } = await supabase
    .from("boards")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();
  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });
  // auditoria
  try {
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
    await supabase.from("board_history").insert({
      board_id: id,
      actor_id,
      action: "board.updated",
      payload: { before, after: update }
    } as any);
  } catch {}
  return NextResponse.json({ data });
}

export async function DELETE(req: NextRequest) {
  const supabase = getSupabaseServerClient();
  const body = await req.json();
  const { id } = body ?? {};
  if (!id)
    return NextResponse.json({ error: "id é obrigatório" }, { status: 422 });
  // remover cartões e listas do board (evita erro de FK se não houver cascade)
  const { data: lists } = await supabase
    .from("lists")
    .select("id")
    .eq("board_id", id);
  if (lists && lists.length) {
    const listIds = lists.map((l: any) => l.id);
    await supabase.from("cards").delete().in("board_id", [id]); // por segurança
    await supabase.from("lists").delete().in("id", listIds);
  }
  const { error } = await supabase.from("boards").delete().eq("id", id);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
