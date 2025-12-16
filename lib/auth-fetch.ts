import { getSupabaseBrowserClient } from "./supabase-client";

export async function authFetch(input: RequestInfo | URL, init?: RequestInit) {
	const supabase = getSupabaseBrowserClient() as any;
	const { data } = await supabase.auth.getSession();
	const headers = new Headers(init?.headers || {});
	const token: string | undefined = data?.session?.access_token;
	if (token) {
		headers.set("Authorization", `Bearer ${token}`);
	}
	return fetch(input, { ...init, headers });
}


