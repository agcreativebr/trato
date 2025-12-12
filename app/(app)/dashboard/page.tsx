'use client';

import { useEffect, useMemo, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { LogOut, Plus } from 'lucide-react';
import { motion } from 'framer-motion';

type Workspace = { id: string; name: string; created_at: string };
type Board = { id: string; name: string; workspace_id: string; created_at: string };

export default function DashboardPage() {
	const supabase = useMemo(() => getSupabaseBrowserClient() as any, []);
	const router = useRouter();
	const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
	const [boardsByWorkspace, setBoardsByWorkspace] = useState<Record<string, Board[]>>({});
	const [loading, setLoading] = useState(true);
	const [newWorkspaceName, setNewWorkspaceName] = useState('');
	const [creating, setCreating] = useState(false);
	const [errorMsg, setErrorMsg] = useState<string | null>(null);

	useEffect(() => {
		let mounted = true;
		(async () => {
			const { data } = await supabase.auth.getUser();
			if (!data.user) {
				router.replace('/login');
				return;
			}
			const { data: wspaces, error } = await supabase.from('workspaces').select('*').order('created_at', { ascending: false });
			if (error) {
				setErrorMsg(error.message);
			}
			if (!mounted) return;
			const safeWspaces: Workspace[] = Array.isArray(wspaces) ? (wspaces as any) : [];
			setWorkspaces(safeWspaces);
			const map: Record<string, Board[]> = {};
			for (const ws of safeWspaces) {
				const { data: boards } = await supabase.from('boards').select('*').eq('workspace_id', ws.id).order('created_at', { ascending: false });
				map[ws.id] = boards ?? [];
			}
			if (!mounted) return;
			setBoardsByWorkspace(map);
			setLoading(false);
		})();
		return () => {
			mounted = false;
		};
	}, [supabase, router]);

	async function createWorkspace() {
		if (!newWorkspaceName.trim()) return;
		setCreating(true);
		setErrorMsg(null);
		try {
			const { error } = await supabase.from('workspaces').insert({ name: newWorkspaceName } as any);
			if (error) {
				setErrorMsg(error.message);
				return;
			}
			// refetch após criação (evita depender de RETURNING + RLS)
			const { data: wspaces } = await supabase.from('workspaces').select('*').order('created_at', { ascending: false });
			setWorkspaces(wspaces ?? []);
			setNewWorkspaceName('');
		} finally {
			setCreating(false);
		}
	}

	async function createBoard(workspaceId: string) {
		const name = prompt('Nome do board:')?.trim();
		if (!name) return;
		const { error } = await supabase.from('boards').insert({ name, workspace_id: workspaceId } as any);
		if (error) {
			setErrorMsg(error.message);
			return;
		}
		const { data: boards } = await supabase.from('boards').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false });
		setBoardsByWorkspace((prev) => ({ ...prev, [workspaceId]: boards ?? [] }));
	}

	if (loading)
		return (
			<div className="p-6">
				<p>Carregando...</p>
			</div>
		);

	return (
		<div className="p-6 space-y-8">
			<header className="flex items-center justify-between">
				<h1 className="text-2xl font-semibold">Dashboard</h1>
				<Button
					variant="ghost"
					leftIcon={<LogOut size={16} />}
					onClick={async () => {
						await supabase.auth.signOut();
						location.href = '/login';
					}}
				>
					Sair
				</Button>
			</header>
			<section className="space-y-3">
				<h2 className="text-lg font-medium">Criar Workspace</h2>
				<div className="flex gap-2">
					<input
						className="border rounded px-3 py-2 focus:ring-2 focus:ring-neutral-300 outline-none"
						placeholder="Nome do workspace"
						value={newWorkspaceName}
						onChange={(e) => setNewWorkspaceName(e.target.value)}
					/>
					<Button onClick={createWorkspace} isLoading={creating} leftIcon={<Plus size={16} />}>
						{creating ? 'Criando...' : 'Criar'}
					</Button>
				</div>
				{errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}
			</section>
			<section className="space-y-4">
				{workspaces.length === 0 && <p className="text-neutral-600">Nenhum workspace. Crie o primeiro acima.</p>}
				<div className="grid grid-cols-1 md:grid-cols-3 gap-3">
					{workspaces.map((ws, idx) => (
						<motion.div
							key={ws.id}
							className="bg-white/80 backdrop-blur border rounded p-4 hover:shadow transition"
							initial={{ opacity: 0, y: 10 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: idx * 0.03 }}
						>
							<div className="flex items-center justify-between mb-3">
								<h3 className="font-semibold">{ws.name}</h3>
								<Button variant="ghost" size="sm" leftIcon={<Plus size={16} />} onClick={() => createBoard(ws.id)}>
									Board
								</Button>
							</div>
							<div className="space-y-2">
								{(boardsByWorkspace[ws.id] ?? []).map((b) => (
									<Link
										key={b.id}
										href={`/workspaces/${ws.id}/boards/${b.id}`}
										className="block border rounded p-3 hover:bg-neutral-50"
									>
										{b.name}
									</Link>
								))}
								{(boardsByWorkspace[ws.id] ?? []).length === 0 && (
									<p className="text-sm text-neutral-600">Sem boards ainda.</p>
								)}
							</div>
						</motion.div>
					))}
				</div>
			</section>
		</div>
	);
}

