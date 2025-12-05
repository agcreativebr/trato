'use client';

import { useEffect, useMemo, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';
import { KanbanBoard } from '@/components/KanbanBoard';
import { useParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { ArrowLeft } from 'lucide-react';

export default function BoardPage() {
	const params = useParams();
	const workspaceId = params?.workspaceId as string;
	const boardId = params?.boardId as string;
	const supabase = useMemo(() => getSupabaseBrowserClient(), []);
	const [loading, setLoading] = useState(true);
	const [boardName, setBoardName] = useState<string>('');
	const router = useRouter();

	useEffect(() => {
		let mounted = true;
		(async () => {
			const { data: auth } = await supabase.auth.getUser();
			if (!auth.user) {
				router.replace('/login');
				return;
			}
			const { data: board } = await supabase.from('boards').select('name').eq('id', boardId).single();
			if (mounted) {
				setBoardName(board?.name ?? 'Board');
				setLoading(false);
			}
		})();
		return () => {
			mounted = false;
		};
	}, [boardId, supabase, router]);

	if (loading) return <div className="p-6">Carregando...</div>;
	return (
		<div className="pb-2">
			<div className="px-6 py-4 bg-gradient-to-r from-indigo-50 via-white to-purple-50 border-b">
				<div className="flex items-center justify-between">
					<h1 className="text-xl font-semibold">{boardName}</h1>
					<Button variant="ghost" leftIcon={<ArrowLeft size={16} />} onClick={() => router.push('/dashboard')}>
						Voltar
					</Button>
				</div>
			</div>
			<KanbanBoard boardId={boardId} workspaceId={workspaceId} />
		</div>
	);
}

