import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
	const supabase = getSupabaseServerClient();
	const body = await req.json();
	const { name, board_id, position } = body ?? {};
	if (!name || !board_id || typeof position !== 'number') return NextResponse.json({ error: 'name, board_id e position são obrigatórios' }, { status: 422 });
	const { data, error } = await supabase.from('lists').insert({ name, board_id, position }).select('*').single();
	if (error) return NextResponse.json({ error: error.message }, { status: 400 });
	return NextResponse.json({ data });
}

export async function PATCH(req: NextRequest) {
	const supabase = getSupabaseServerClient();
	const body = await req.json();
	const { id, name, position } = body ?? {};
	if (!id) return NextResponse.json({ error: 'id é obrigatório' }, { status: 422 });
	// captura estado anterior
	const { data: before } = await supabase.from('lists').select('*').eq('id', id).single();
	const update: Record<string, unknown> = {};
	if (typeof name === 'string') update.name = name;
	if (typeof position === 'number') update.position = position;
	const { data, error } = await supabase.from('lists').update(update).eq('id', id).select('*').single();
	if (error) return NextResponse.json({ error: error.message }, { status: 400 });
	// auditoria: renomeio/posicionamento
	try {
		let actor_id: string | null = null;
		try {
			const hdr = req.headers.get('authorization') ?? req.headers.get('x-sb-access-token') ?? '';
			const tokenHeader = hdr?.toLowerCase().startsWith('bearer ') ? hdr.slice(7) : hdr || undefined;
			const token = tokenHeader ?? cookies().get('sb-access-token')?.value;
			if (token) {
				const { data: authUser } = await supabase.auth.getUser(token);
				actor_id = authUser?.user?.id ?? null;
			}
		} catch {}
		const { data: board } = await supabase.from('boards').select('id').eq('id', (before as any)?.board_id ?? (data as any)?.board_id).maybeSingle();
		await supabase.from('board_history').insert({
			board_id: (board as any)?.id ?? (data as any)?.board_id,
			actor_id,
			action: 'list.updated',
			payload: { list_id: id, before, after: update }
		} as any);
	} catch {}
	return NextResponse.json({ data });
}

