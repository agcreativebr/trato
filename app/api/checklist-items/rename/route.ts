import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { cookies } from "next/headers";

// POST { item_id, title }
export async function POST(req: NextRequest) {
  const supabase = getSupabaseServerClient();
  const body = await req.json();
  const { item_id, title } = body ?? {};
  if (!item_id || typeof title !== "string") return NextResponse.json({ error: "item_id e title são obrigatórios" }, { status: 422 });
  const { data: before } = await supabase.from("checklist_items").select("id, title, checklist_id").eq("id", item_id).single();
  if (!before) return NextResponse.json({ error: "Item não encontrado" }, { status: 404 });
  const { data: cl } = await supabase.from("checklists").select("card_id").eq("id", (before as any).checklist_id).single();
  const cardId = (cl as any)?.card_id as string | undefined;
  const { error } = await supabase.from("checklist_items").update({ title }).eq("id", item_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  // audit
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
    if (cardId) {
      await supabase.from("card_history").insert({
        card_id: cardId,
        action: "checklist.item_renamed",
        actor_id,
        payload: { item_id, before_title: (before as any).title, after_title: title }
      } as any);
    }
  } catch {}
  return NextResponse.json({ ok: true });
}


