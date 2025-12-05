import { createClient } from '@supabase/supabase-js';

export function getSupabaseServerClient() {
	const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
	const serviceRole = process.env.SUPABASE_SERVICE_ROLE!;
	return createClient(url, serviceRole);
}

