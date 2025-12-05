import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase-server';

export async function GET() {
	const supabase = getSupabaseServerClient();
	const { data, error } = await supabase.from('workspaces').select('*').order('created_at', { ascending: false });
	if (error) return NextResponse.json({ error: error.message }, { status: 400 });
	return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
	const supabase = getSupabaseServerClient();
	const body = await req.json();
	const { name } = body ?? {};
	if (!name) return NextResponse.json({ error: 'name é obrigatório' }, { status: 422 });
	const { data, error } = await supabase.from('workspaces').insert({ name }).select('*').single();
	if (error) return NextResponse.json({ error: error.message }, { status: 400 });
	return NextResponse.json({ data });
}

