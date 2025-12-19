import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { cookies } from "next/headers";

// POST { board_id, list_id, to_index, new_position }
export async function POST(req: NextRequest) {
  const supabase = getSupabaseServerClient();
  const body = await req.json();
  const { board_id, list_id, to_index, new_position } = body ?? {};
  if (!list_id || typeof new_position !== "number") {
    return NextResponse.json({ error: "list_id e new_position são obrigatórios" }, { status: 422 });
  }
  try {
    // captura estado anterior e nome
    const { data: before } = await supabase.from("lists").select("id, board_id, name, position").eq("id", list_id).single();
    // aplica atualização
    const { data, error } = await supabase.from("lists").update({ position: new_position }).eq("id", list_id).select("id, board_id, position").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

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
      const bId = board_id ?? (before as any)?.board_id ?? (data as any)?.board_id;
      await supabase.from("board_history").insert({
        board_id: bId,
        actor_id,
        action: "list.moved",
        payload: {
          list_id,
          list_name: (before as any)?.name ?? null,
          from_position: (before as any)?.position,
          to_position: (data as any)?.position,
          to_index: typeof to_index === "number" ? to_index : null,
        },
      } as any);
    } catch {}

    return NextResponse.json({ data });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 });
  }
}


