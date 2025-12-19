import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";

// POST { workspace_id, user_id?, email? } -> reenviar convite
export async function POST(req: NextRequest) {
  const supabase = getSupabaseServerClient() as any;
  const body = await req.json();
  const { user_id, email } = body ?? {};
  if (!user_id && !email) return NextResponse.json({ error: "user_id ou email é obrigatório" }, { status: 422 });
  try {
    let targetEmail = email as string | undefined;
    if (!targetEmail && user_id) {
      try {
        const { data: page } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
        const u = (page?.users ?? []).find((x: any) => x.id === user_id);
        targetEmail = u?.email;
      } catch {}
    }
    if (!targetEmail) return NextResponse.json({ error: "E-mail não encontrado para o usuário" }, { status: 404 });

    // tenta reenviar por e-mail
    try {
      await supabase.auth.admin.inviteUserByEmail(targetEmail);
    } catch {}

    // sempre retorna um link de ação para fallback
    let action_link: string | null = null;
    const origin = new URL(req.url).origin;
    try {
      const { data } = await supabase.auth.admin.generateLink({
        type: "magiclink",
        email: targetEmail,
        options: {
          redirectTo: `${origin}/dashboard`,
        },
      } as any);
      action_link = (data as any)?.properties?.action_link ?? (data as any)?.action_link ?? null;
    } catch {}

    return NextResponse.json({ ok: true, action_link });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Falha ao reenviar convite" }, { status: 400 });
  }
}


