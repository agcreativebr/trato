import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
	const supabase = getSupabaseServerClient();
	const { searchParams } = new URL(req.url);
	const q = (searchParams.get('q') || '').trim();
	let query = supabase.from('user_profiles').select('id, display_name, avatar_url').limit(8);
	if (q) {
		// case-insensitive contains
		query = query.ilike('display_name', `%${q}%`);
	}
	const { data, error } = await query;
	if (error) return NextResponse.json({ error: error.message }, { status: 400 });
	return NextResponse.json({ data });
}


