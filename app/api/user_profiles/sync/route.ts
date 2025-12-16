import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { cookies } from "next/headers";

export async function GET(_req: NextRequest) {
	const supabase = getSupabaseServerClient();
	try {
		const hdr = _req.headers.get("authorization") ?? _req.headers.get("x-sb-access-token") ?? "";
		const tokenFromHeader = hdr?.toLowerCase().startsWith("bearer ") ? hdr.slice(7) : hdr || undefined;
		const token = tokenFromHeader ?? cookies().get("sb-access-token")?.value;
		if (!token) return NextResponse.json({ error: "Sem token" }, { status: 401 });
		const { data: auth } = await supabase.auth.getUser(token);
		const u = auth?.user;
		if (!u?.id) return NextResponse.json({ error: "Sem usuário" }, { status: 401 });
		const display =
			(u.user_metadata as any)?.full_name ||
			(u.user_metadata as any)?.name ||
			u.email?.split("@")[0] ||
			"Usuário";
		const avatar = (u.user_metadata as any)?.avatar_url ?? null;
		const { data, error } = await supabase
			.from("user_profiles")
			.upsert({ id: u.id, display_name: display, avatar_url: avatar } as any, {
				onConflict: "id",
			})
			.select("id, display_name, avatar_url")
			.single();
		if (error) return NextResponse.json({ error: error.message }, { status: 400 });
		return NextResponse.json({ data });
	} catch (e: any) {
		return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 });
	}
}


