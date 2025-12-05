'use client';

import { useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Mail } from 'lucide-react';
import { motion } from 'framer-motion';

export default function LoginPage() {
	const [email, setEmail] = useState('');
	const [loading, setLoading] = useState(false);
	const [message, setMessage] = useState<string | null>(null);
	const router = useRouter();

	async function handleLogin(e: React.FormEvent) {
		e.preventDefault();
		setLoading(true);
		setMessage(null);
		try {
			const supabase = getSupabaseBrowserClient();
			const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: typeof window !== 'undefined' ? window.location.origin + '/dashboard' : undefined } });
			if (error) {
				setMessage(error.message);
			} else {
				setMessage('Enviamos um link mágico para seu e-mail.');
			}
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className="min-h-screen flex items-center justify-center p-6">
			<motion.form
				onSubmit={handleLogin}
				className="bg-white/80 backdrop-blur border border-neutral-200 p-8 rounded-xl shadow w-full max-w-sm space-y-5"
				initial={{ opacity: 0, y: 10 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.3 }}
			>
				<h1 className="text-2xl font-semibold">Entrar</h1>
				<div className="space-y-2">
					<label className="text-sm text-neutral-700">E-mail</label>
					<input
						type="email"
						placeholder="voce@empresa.com"
						className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-neutral-300 outline-none"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						required
					/>
				</div>
				<Button type="submit" isLoading={loading} className="w-full" leftIcon={<Mail size={16} />}>
					{loading ? 'Enviando...' : 'Enviar link mágico'}
				</Button>
				{message && <p className="text-sm text-neutral-700">{message}</p>}
				<Button
					type="button"
					variant="ghost"
					className="w-full"
					onClick={async () => {
						const supabase = getSupabaseBrowserClient();
						const { data } = await supabase.auth.getSession();
						if (data.session) {
							router.replace('/dashboard');
						}
					}}
				>
					Já tem sessão ativa? Ir ao dashboard
				</Button>
			</motion.form>
		</div>
	);
}

