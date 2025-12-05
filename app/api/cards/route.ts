import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
	const supabase = getSupabaseServerClient();
	const body = await req.json();
	const { title, board_id, list_id, position, description, due_date } = body ?? {};
	if (!title || !board_id || !list_id || typeof position !== 'number')
		return NextResponse.json({ error: 'title, board_id, list_id e position são obrigatórios' }, { status: 422 });
	const insert = { title, board_id, list_id, position, description: description ?? null, due_date: due_date ?? null };
	const { data, error } = await supabase.from('cards').insert(insert).select('*').single();
	if (error) return NextResponse.json({ error: error.message }, { status: 400 });
	// history
	await supabase.from('card_history').insert({
		card_id: data.id,
		action: 'created',
		payload: insert
	});
	return NextResponse.json({ data });
}

export async function PATCH(req: NextRequest) {
	const supabase = getSupabaseServerClient();
	const body = await req.json();
	const { id, ...rest } = body ?? {};
	if (!id) return NextResponse.json({ error: 'id é obrigatório' }, { status: 422 });
	const { data, error } = await supabase.from('cards').update(rest).eq('id', id).select('*').single();
	if (error) return NextResponse.json({ error: error.message }, { status: 400 });
	await supabase.from('card_history').insert({
		card_id: data.id,
		action: 'updated',
		payload: rest
	});
	return NextResponse.json({ data });
}

