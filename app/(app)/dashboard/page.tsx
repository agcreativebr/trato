'use client';

import { useEffect, useMemo, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { LogOut, Plus, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import { Modal } from '@/components/ui/Modal';

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
	const [membersOpen, setMembersOpen] = useState(false);
	const [membersLoading, setMembersLoading] = useState(false);
	const [members, setMembers] = useState<{ user_id: string; role: 'admin'|'editor'|'viewer'; email?: string|null; pending?: boolean; profile?: { display_name?: string|null; avatar_url?: string|null } | null }[]>([]);
	const [targetWorkspaceId, setTargetWorkspaceId] = useState<string | null>(null);
	const [inviteEmail, setInviteEmail] = useState('');
	const [inviteRole, setInviteRole] = useState<'admin'|'editor'|'viewer'>('editor');

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

	async function openMembers(wsId: string) {
		setTargetWorkspaceId(wsId);
		setMembersOpen(true);
		setMembersLoading(true);
		try {
			const res = await fetch(`/api/workspaces/members?workspaceId=${wsId}`);
			const json = await res.json();
			setMembers(json.data ?? []);
		} finally {
			setMembersLoading(false);
		}
	}

	async function addMember() {
		if (!targetWorkspaceId || !inviteEmail.trim()) return;
		setMembersLoading(true);
		try {
			const res = await fetch('/api/workspaces/members', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ workspace_id: targetWorkspaceId, email: inviteEmail.trim(), role: inviteRole }),
			});
			const json = await res.json();
			if (json?.error) {
				alert(json.error);
				return;
			}
			setInviteEmail('');
			await openMembers(targetWorkspaceId);
		} finally {
			setMembersLoading(false);
		}
	}

	async function updateRole(userId: string, role: 'admin'|'editor'|'viewer') {
		if (!targetWorkspaceId) return;
		const res = await fetch('/api/workspaces/members', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ workspace_id: targetWorkspaceId, user_id: userId, role }),
		});
		const json = await res.json();
		if (json?.error) {
			alert(json.error);
			return;
		}
		setMembers((prev) => prev.map((m) => (m.user_id === userId ? { ...m, role } : m)));
	}

	async function removeMember(userId: string) {
		if (!targetWorkspaceId) return;
		if (!confirm('Remover este membro do workspace?')) return;
		const res = await fetch('/api/workspaces/members', {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ workspace_id: targetWorkspaceId, user_id: userId }),
		});
		const json = await res.json();
		if (json?.error) {
			alert(json.error);
			return;
		}
		setMembers((prev) => prev.filter((m) => m.user_id !== userId));
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
								<div className="flex items-center gap-2">
									<Button variant="ghost" size="sm" leftIcon={<Users size={16} />} onClick={() => openMembers(ws.id)}>
										Membros
									</Button>
									<Button variant="ghost" size="sm" leftIcon={<Plus size={16} />} onClick={() => createBoard(ws.id)}>
										Board
									</Button>
								</div>
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

			<Modal open={membersOpen} onClose={() => setMembersOpen(false)}>
				<div className="p-4 w-full max-w-none">
					<div className="flex items-center justify-between mb-3">
						<div className="text-lg font-semibold">Membros do workspace</div>
						<button className="h-8 w-8 inline-flex items-center justify-center rounded hover:bg-neutral-100" onClick={() => setMembersOpen(false)}>×</button>
					</div>
					<div className="space-y-3">
						<div className="flex flex-wrap items-center gap-2">
							<input
								className="border rounded px-3 py-2 flex-1 min-w-[220px]"
								placeholder="E-mail do usuário"
								value={inviteEmail}
								onChange={(e) => setInviteEmail(e.target.value)}
							/>
							<select className="border rounded px-2 py-2" value={inviteRole} onChange={(e) => setInviteRole(e.target.value as any)}>
								<option value="editor">Editor</option>
								<option value="admin">Admin</option>
								<option value="viewer">Observador</option>
							</select>
							<Button isLoading={membersLoading} onClick={addMember}>Adicionar</Button>
						</div>
						<div className="border rounded w-full">
							{membersLoading ? (
								<div className="p-3 text-sm text-neutral-600">Carregando membros…</div>
							) : members.length === 0 ? (
								<div className="p-3 text-sm text-neutral-600">Nenhum membro.</div>
							) : (
								<div className="overflow-x-auto">
								<table className="w-full text-sm table-fixed">
									<colgroup>
										<col className="w-[50%]" />
										<col className="w-[15%]" />
										<col className="w-[35%]" />
									</colgroup>
									<thead>
										<tr className="text-left border-b">
											<th className="px-3 py-2">Usuário</th>
											<th className="px-3 py-2">Papel</th>
											<th className="px-3 py-2 text-right">Ações</th>
										</tr>
									</thead>
									<tbody>
										{members.map((m) => (
											<tr key={m.user_id} className="border-b">
												<td className="px-3 py-2">
													<div className="flex items-center gap-2">
														<div className="min-w-0">
															<div className="truncate">{m.profile?.display_name ?? m.email ?? m.user_id}</div>
															{m.email ? <div className="text-xs text-neutral-500 truncate">{m.email}</div> : null}
														</div>
														{m.pending ? <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">Pendente</span> : null}
													</div>
												</td>
												<td className="px-3 py-2">
													<select className="border rounded px-2 py-1" value={m.role} onChange={(e) => updateRole(m.user_id, e.target.value as any)}>
														<option value="admin">Admin</option>
														<option value="editor">Editor</option>
														<option value="viewer">Observador</option>
													</select>
												</td>
												<td className="px-3 pr-4 py-2 text-right whitespace-nowrap">
													<div className="flex gap-2 justify-end flex-wrap w-full">
														{m.pending ? (
															<Button
																variant="ghost"
																size="sm"
																onClick={async () => {
																	const r = await fetch('/api/workspaces/members/resend', {
																		method: 'POST',
																		headers: { 'Content-Type': 'application/json' },
																		body: JSON.stringify({ user_id: m.user_id, email: m.email }),
																	});
																	const j = await r.json();
																	if (j?.action_link) {
																		try {
																			await navigator.clipboard.writeText(j.action_link);
																			alert('Convite reenviado. Link copiado para a área de transferência.');
																		} catch {
																			prompt('Convite reenviado. Copie o link:', j.action_link);
																		}
																	} else {
																		alert('Convite reenviado.');
																	}
																}}
															>
																Reenviar
															</Button>
														) : null}
														{m.pending ? (
															<Button
																variant="ghost"
																size="sm"
																onClick={async () => {
																	const res = await fetch('/api/workspaces/members/invite', {
																		method: 'POST',
																		headers: { 'Content-Type': 'application/json' },
																		body: JSON.stringify({ email: m.email }),
																	});
																	const json = await res.json();
																	if (json?.action_link) {
																		try {
																			await navigator.clipboard.writeText(json.action_link);
																			alert('Link de convite copiado para a área de transferência.');
																		} catch {
																			prompt('Copie o link abaixo:', json.action_link);
																		}
																	} else if (json?.ok) {
																		alert('Convite reenviado.');
																	} else if (json?.error) {
																		alert(json.error);
																	}
																}}
															>
																Copiar
															</Button>
														) : null}
														<Button variant="ghost" size="sm" onClick={() => removeMember(m.user_id)}>Remover</Button>
													</div>
												</td>
											</tr>
										))}
									</tbody>
								</table>
								</div>
							)}
						</div>
					</div>
				</div>
			</Modal>
		</div>
	);
}

