import { getSupabaseBrowserClient } from './supabase-client';

export async function requireClientSession(): Promise<boolean> {
	const supabase = getSupabaseBrowserClient();
	const { data } = await supabase.auth.getSession();
	return !!data.session;
}

