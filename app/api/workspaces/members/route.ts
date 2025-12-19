import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase-server';

// GET /api/workspaces/members?workspaceId=...
export async function GET(req: NextRequest) {
	const supabase = getSupabaseServerClient() as any;
	const { searchParams } = new URL(req.url);
	const workspaceId = searchParams.get('workspaceId');
	if (!workspaceId) return NextResponse.json({ error: 'workspaceId é obrigatório' }, { status: 422 });
	// Lista membros (join com user_profiles se existir)
	const { data: members, error } = await supabase
		.from('workspace_members')
		.select('user_id, role')
		.eq('workspace_id', workspaceId);
	if (error) return NextResponse.json({ error: error.message }, { status: 400 });
	let profiles: Record<string, any> = {};
	let usersById: Record<string, any> = {};
	try {
		const { data: profs } = await supabase.from('user_profiles').select('id, display_name, avatar_url').in('id', (members ?? []).map((m: any) => m.user_id));
		profiles = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p]));
		// pega status/email dos usuários (para exibir "Pendente")
		try {
			const { data: page } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
			const all = page?.users ?? [];
			for (const u of all) {
				usersById[u.id] = u;
			}
		} catch {}
	} catch {}
	const result = (members ?? []).map((m: any) => {
		const u = usersById[m.user_id];
		const email = u?.email ?? null;
		const pending = !u?.email_confirmed_at && !u?.confirmed_at;
		return { user_id: m.user_id, role: m.role, email, pending, profile: profiles[m.user_id] ?? null };
	});
	return NextResponse.json({ data: result });
}

// POST /api/workspaces/members  { workspace_id, email|user_id, role }
export async function POST(req: NextRequest) {
	const supabase = getSupabaseServerClient() as any;
	const body = await req.json();
	const { workspace_id, email, user_id, role } = body ?? {};
	if (!workspace_id || (!email && !user_id)) {
		return NextResponse.json({ error: 'workspace_id e (email ou user_id) são obrigatórios' }, { status: 422 });
	}
	const finalRole = role && ['admin','editor','viewer'].includes(role) ? role : 'editor';
	let targetUserId = user_id as string | undefined;
	if (!targetUserId && email) {
		// tenta localizar usuário pelo e-mail via admin API
		try {
			const { data: usersPage, error: adminErr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
			if (adminErr) throw adminErr;
			const found = (usersPage?.users ?? []).find((u: any) => (u.email ?? '').toLowerCase() === String(email).toLowerCase());
			if (!found) {
				// Não existe: envia convite e cria o usuário
				try {
					const { data: invite } = await supabase.auth.admin.inviteUserByEmail(String(email));
					targetUserId = invite?.user?.id;
				} catch (e) {
					// fallback: cria o usuário sem confirmar (envia e-mail padrão)
					const { data: created } = await supabase.auth.admin.createUser({
						email: String(email),
						email_confirm: false,
					});
					targetUserId = created?.user?.id;
				}
				if (!targetUserId) {
					return NextResponse.json({ error: 'Falha ao convidar/criar usuário para este e-mail.' }, { status: 400 });
				}
				// garante um perfil básico
				try {
					const display = String(email).split('@')[0];
					await supabase.from('user_profiles').upsert({ id: targetUserId, display_name: display } as any, { onConflict: 'id' });
				} catch {}
			} else {
				targetUserId = found.id;
			}
		} catch (e: any) {
			return NextResponse.json({ error: e?.message ?? 'Falha ao consultar usuários' }, { status: 400 });
		}
	}
	try {
		const { data, error } = await supabase
			.from('workspace_members')
			.insert({ workspace_id, user_id: targetUserId, role: finalRole } as any)
			.select('*')
			.single();
		if (error) return NextResponse.json({ error: error.message }, { status: 400 });
		return NextResponse.json({ data });
	} catch (e: any) {
		return NextResponse.json({ error: e?.message ?? 'Erro ao adicionar membro' }, { status: 400 });
	}
}

// PATCH /api/workspaces/members  { workspace_id, user_id, role }
export async function PATCH(req: NextRequest) {
	const supabase = getSupabaseServerClient() as any;
	const body = await req.json();
	const { workspace_id, user_id, role } = body ?? {};
	if (!workspace_id || !user_id || !role) return NextResponse.json({ error: 'workspace_id, user_id e role são obrigatórios' }, { status: 422 });
	if (!['admin','editor','viewer'].includes(role)) return NextResponse.json({ error: 'role inválido' }, { status: 422 });
	const { data, error } = await supabase
		.from('workspace_members')
		.update({ role } as any)
		.eq('workspace_id', workspace_id)
		.eq('user_id', user_id)
		.select('*')
		.single();
	if (error) return NextResponse.json({ error: error.message }, { status: 400 });
	return NextResponse.json({ data });
}

// DELETE /api/workspaces/members  { workspace_id, user_id }
export async function DELETE(req: NextRequest) {
	const supabase = getSupabaseServerClient() as any;
	const body = await req.json();
	const { workspace_id, user_id } = body ?? {};
	if (!workspace_id || !user_id) return NextResponse.json({ error: 'workspace_id e user_id são obrigatórios' }, { status: 422 });
	const { error } = await supabase
		.from('workspace_members')
		.delete()
		.eq('workspace_id', workspace_id)
		.eq('user_id', user_id);
	if (error) return NextResponse.json({ error: error.message }, { status: 400 });
	return NextResponse.json({ ok: true });
}



