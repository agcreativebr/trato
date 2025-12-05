import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase-server';

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
	const update: Record<string, unknown> = {};
	if (typeof name === 'string') update.name = name;
	if (typeof position === 'number') update.position = position;
	const { data, error } = await supabase.from('lists').update(update).eq('id', id).select('*').single();
	if (error) return NextResponse.json({ error: error.message }, { status: 400 });
	return NextResponse.json({ data });
}

