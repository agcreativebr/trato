import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
	const supabase = getSupabaseServerClient();
	const { searchParams } = new URL(req.url);
	const workspaceId = searchParams.get('workspaceId');
	if (!workspaceId) return NextResponse.json({ error: 'workspaceId é obrigatório' }, { status: 422 });
	const { data, error } = await supabase.from('boards').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false });
	if (error) return NextResponse.json({ error: error.message }, { status: 400 });
	return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
	const supabase = getSupabaseServerClient();
	const body = await req.json();
	const { name, workspace_id } = body ?? {};
	if (!name || !workspace_id) return NextResponse.json({ error: 'name e workspace_id são obrigatórios' }, { status: 422 });
	const { data, error } = await supabase.from('boards').insert({ name, workspace_id }).select('*').single();
	if (error) return NextResponse.json({ error: error.message }, { status: 400 });
	return NextResponse.json({ data });
}

