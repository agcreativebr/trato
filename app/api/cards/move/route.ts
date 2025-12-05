import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
	const supabase = getSupabaseServerClient();
	const body = await req.json();
	const { id, list_id, position } = body ?? {};
	if (!id || !list_id || typeof position !== 'number') return NextResponse.json({ error: 'id, list_id e position são obrigatórios' }, { status: 422 });
	const { data, error } = await supabase.from('cards').update({ list_id, position }).eq('id', id).select('*').single();
	if (error) return NextResponse.json({ error: error.message }, { status: 400 });
	await supabase.from('card_history').insert({
		card_id: data.id,
		action: 'moved',
		payload: { list_id, position }
	});
	return NextResponse.json({ data });
}

