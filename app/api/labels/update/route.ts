import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
	const supabase = getSupabaseServerClient();
	const body = await req.json();
	const { id, name, color } = body ?? {};
	if (!id) return NextResponse.json({ error: 'id é obrigatório' }, { status: 422 });
	const update: any = {};
	if (typeof name === 'string') update.name = name;
	if (typeof color === 'string') update.color = color;
	const { data, error } = await supabase.from('labels').update(update).eq('id', id).select('*').single();
	if (error) return NextResponse.json({ error: error.message }, { status: 400 });
	return NextResponse.json({ data });
}


