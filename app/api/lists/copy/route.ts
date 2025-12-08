import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
	const supabase = getSupabaseServerClient();
	const body = await req.json();
	const { list_id, target_board_id, name } = body ?? {};
	if (!list_id || !target_board_id) return NextResponse.json({ error: 'list_id e target_board_id são obrigatórios' }, { status: 422 });

	// pega posição
	const { data: last } = await supabase.from('lists').select('position').eq('board_id', target_board_id).order('position', { ascending: false }).limit(1);
	const newPos = last && last.length ? (last[0] as any).position + 100 : 100;

	// cria nova lista
	const { data: source } = await supabase.from('lists').select('name').eq('id', list_id).single();
	const newName = name ?? (source?.name ? `${source.name} (Cópia)` : 'Cópia');
	const { data: newList, error: eList } = await supabase.from('lists').insert({ name: newName, board_id: target_board_id, position: newPos }).select('*').single();
	if (eList) return NextResponse.json({ error: eList.message }, { status: 400 });

	// copia cartões
	const { data: cards } = await supabase.from('cards').select('*').eq('list_id', list_id).order('position', { ascending: true });
	for (let i = 0; i < (cards ?? []).length; i++) {
		const c: any = (cards as any[])[i];
		const { data: newCard } = await supabase.from('cards').insert({
			title: c.title,
			description: c.description,
			board_id: target_board_id,
			list_id: newList.id,
			position: (i + 1) * 100,
			due_date: c.due_date,
			start_date: c.start_date
		}).select('*').single();

		// copia anexos (inclui capa se existir)
		const { data: atts } = await supabase.from('attachments').select('*').eq('card_id', c.id);
		for (const a of atts ?? []) {
			const srcPath = (a as any).path as string;
			const filename = srcPath.split('/').pop() as string;
			const dstPath = `${newCard!.id}/${filename}`;
			// copia no storage e insere linha
			await supabase.storage.from('attachments').copy(srcPath, dstPath);
			await supabase.from('attachments').insert({ card_id: newCard!.id, filename: (a as any).filename, path: dstPath });
			// se a capa antiga era este arquivo, atualiza capa nova
			if (c.cover_path && c.cover_path === srcPath) {
				await supabase.from('cards').update({ cover_path: dstPath, cover_size: c.cover_size }).eq('id', newCard!.id);
			}
		}
	}

	return NextResponse.json({ data: newList });
}


