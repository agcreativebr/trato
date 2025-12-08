import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  const supabase = getSupabaseServerClient();
  const body = await req.json();
  // aceita 'position' absoluto OU 'positionIndex' (1..n+1)
  const { list_id, target_board_id, position, positionIndex } = body ?? {};
  if (!list_id || !target_board_id) {
    return NextResponse.json(
      { error: "list_id e target_board_id são obrigatórios" },
      { status: 422 }
    );
  }
  let finalPosition = position as number | undefined;
  if (typeof finalPosition !== "number") {
    // calcula posição pela média dos vizinhos com base no índice desejado
    const { data: lists } = await supabase
      .from("lists")
      .select("*")
      .eq("board_id", target_board_id)
      .neq("id", list_id) // exclui a própria lista ao calcular os vizinhos
      .order("position", { ascending: true });
    const idx = Math.max(
      1,
      Math.min(
        (positionIndex as number) || (lists?.length ?? 0) + 1,
        (lists?.length ?? 0) + 1
      )
    );
    const prev = idx > 1 ? (lists as any[])[idx - 2] : undefined;
    const next =
      idx <= (lists?.length ?? 0) ? (lists as any[])[idx - 1] : undefined;
    if (prev && next) finalPosition = (prev.position + next.position) / 2;
    else if (prev && !next) finalPosition = prev.position + 100;
    else if (!prev && next) finalPosition = next.position - 100;
    else finalPosition = 100;
  }
  // move a lista
  const { data: lst, error } = await supabase
    .from("lists")
    .update({ board_id: target_board_id, position: finalPosition })
    .eq("id", list_id)
    .select("*")
    .single();
  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });
  // move os cartões para o novo board
  const { error: e2 } = await supabase
    .from("cards")
    .update({ board_id: target_board_id })
    .eq("list_id", list_id);
  if (e2) return NextResponse.json({ error: e2.message }, { status: 400 });
  return NextResponse.json({ data: lst });
}
