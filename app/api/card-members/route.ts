import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { cookies } from "next/headers";

// POST { card_id, user_id } -> atribui membro ao cartão
// DELETE { card_id, user_id } -> remove membro do cartão

export async function POST(req: NextRequest) {
	const supabase = getSupabaseServerClient();
	const body = await req.json();
	const { card_id, user_id } = body ?? {};
	if (!card_id || !user_id) return NextResponse.json({ error: "card_id e user_id são obrigatórios" }, { status: 422 });
	try {
		const { error } = await supabase.from("card_members").insert({ card_id, user_id } as any);
		if (error) return NextResponse.json({ error: error.message }, { status: 400 });
		// registra histórico
		let actor_id: string | null = null;
		try {
			const token = cookies().get("sb-access-token")?.value;
			if (token) {
				const { data: authUser } = await supabase.auth.getUser(token);
				actor_id = authUser?.user?.id ?? null;
			}
		} catch {}
		await supabase.from("card_history").insert({
			card_id,
			action: "member.added",
			actor_id,
			payload: { user_id }
		});
		return NextResponse.json({ ok: true });
	} catch (e: any) {
		return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 });
	}
}

export async function DELETE(req: NextRequest) {
	const supabase = getSupabaseServerClient();
	const body = await req.json();
	const { card_id, user_id } = body ?? {};
	if (!card_id || !user_id) return NextResponse.json({ error: "card_id e user_id são obrigatórios" }, { status: 422 });
	try {
		const { error } = await supabase.from("card_members").delete().match({ card_id, user_id });
		if (error) return NextResponse.json({ error: error.message }, { status: 400 });
		// registra histórico
		let actor_id: string | null = null;
		try {
			const token = cookies().get("sb-access-token")?.value;
			if (token) {
				const { data: authUser } = await supabase.auth.getUser(token);
				actor_id = authUser?.user?.id ?? null;
			}
		} catch {}
		await supabase.from("card_history").insert({
			card_id,
			action: "member.removed",
			actor_id,
			payload: { user_id }
		});
		return NextResponse.json({ ok: true });
	} catch (e: any) {
		return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 });
	}
}


