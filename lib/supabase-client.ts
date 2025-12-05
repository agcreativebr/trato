import { createClient } from '@supabase/supabase-js';

let browserClient: ReturnType<typeof createClient> | null = null;

export function getSupabaseBrowserClient() {
	if (browserClient) return browserClient;
	const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
	const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
	browserClient = createClient(url, anon, {
		auth: {
			persistSession: true,
			autoRefreshToken: true,
			detectSessionInUrl: true
		}
	});
	return browserClient;
}


