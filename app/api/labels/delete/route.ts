import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
	const supabase = getSupabaseServerClient();
	const body = await req.json();
	const { id } = body ?? {};
	if (!id) return NextResponse.json({ error: 'id é obrigatório' }, { status: 422 });
	const { error } = await supabase.from('labels').delete().eq('id', id);
	if (error) return NextResponse.json({ error: error.message }, { status: 400 });
	return NextResponse.json({ ok: true });
}


