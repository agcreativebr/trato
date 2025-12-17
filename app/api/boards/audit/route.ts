import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
	const supabase = getSupabaseServerClient();
	const { searchParams } = new URL(req.url);
	const boardId = searchParams.get("board_id");
	const format = (searchParams.get("format") || "json").toLowerCase();
	const start = searchParams.get("start"); // ISO
	const end = searchParams.get("end"); // ISO
	const action = searchParams.get("action") || undefined;
	const actor = searchParams.get("actor_id") || undefined;
	if (!boardId) return NextResponse.json({ error: "board_id é obrigatório" }, { status: 422 });
	// busca histórico do board (join via cards)
	const { data: rows, error } = await supabase
		.rpc("get_board_history", { b_id: boardId as any })
		.select?.?.() as any; // tentativa de RPC; fallback abaixo

	// Fallback: consulta manual (sem RPC)
	let dataRows = rows as any[] | null;
	if (!dataRows) {
		const { data: cards } = await supabase.from("cards").select("id").eq("board_id", boardId);
		const ids = (cards ?? []).map((c: any) => c.id);
		let hist: any[] = [];
		if (ids.length) {
			const { data: h } = await supabase
				.from("card_history")
				.select("id, card_id, action, payload, actor_id, created_at")
				.in("card_id", ids)
				.order("created_at", { ascending: false });
			hist = h ?? [];
		}
		// inclui board_history (lista/board updates)
		const { data: bh } = await supabase
			.from("board_history")
			.select("id, action, payload, actor_id, created_at")
			.eq("board_id", boardId)
			.order("created_at", { ascending: false });
		const boardHist = (bh ?? []).map((r: any) => ({
			timestamp: r.created_at,
			card_id: null,
			actor_id: r.actor_id,
			action: r.action,
			payload: r.payload,
		}));
		const actorIds = Array.from(new Set(hist.map((r) => r.actor_id).filter(Boolean)));
		let profiles: Record<string, string | null> = {};
		if (actorIds.length) {
			const { data: profs } = await supabase.from("user_profiles").select("id, display_name").in("id", actorIds);
			profiles = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.display_name ?? null]));
		}
		dataRows = hist.map((r) => ({
			timestamp: r.created_at,
			card_id: r.card_id,
			actor_id: r.actor_id,
			actor_name: profiles[r.actor_id ?? ""] ?? null,
			action: r.action,
			payload: r.payload,
		})).concat(boardHist);
	}
	// filtros
	if (start) dataRows = (dataRows ?? []).filter((r) => new Date(r.timestamp).getTime() >= new Date(start).getTime());
	if (end) dataRows = (dataRows ?? []).filter((r) => new Date(r.timestamp).getTime() <= new Date(end).getTime());
	if (action) dataRows = (dataRows ?? []).filter((r) => String(r.action) === action);
	if (actor) dataRows = (dataRows ?? []).filter((r) => String(r.actor_id ?? "") === actor);
	if (format === "csv") {
		const headers = ["timestamp", "card_id", "actor_id", "actor_name", "action", "payload"];
		const escape = (v: any) =>
			typeof v === "string"
				? `"${v.replace(/\"/g, '""')}"`
				: v == null
				? ""
				: `"${JSON.stringify(v).replace(/\"/g, '""')}"`;
		const csv = [headers.join(",")].concat(
			(dataRows ?? []).map((r) =>
				[escape(r.timestamp), escape(r.card_id), escape(r.actor_id), escape(r.actor_name), escape(r.action), escape(r.payload)].join(",")
			)
		).join("\n");
		return new NextResponse(csv, {
			headers: {
				"Content-Type": "text/csv; charset=utf-8",
				"Content-Disposition": `attachment; filename="audit_${boardId}.csv"`,
			},
		});
	}
	return NextResponse.json({ data: dataRows });
}


