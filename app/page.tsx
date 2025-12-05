'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';

export default function Home() {
	const router = useRouter();
	useEffect(() => {
		const supabase = getSupabaseBrowserClient();
		supabase.auth.getSession().then(({ data }) => {
			if (data.session) {
				router.replace('/dashboard');
			} else {
				router.replace('/login');
			}
		});
	}, [router]);
	return null;
}

