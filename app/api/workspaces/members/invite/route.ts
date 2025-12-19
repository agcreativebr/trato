import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";

// POST { email } -> gera link de convite (signup/magiclink) e reenvia
export async function POST(req: NextRequest) {
  const supabase = getSupabaseServerClient() as any;
  const body = await req.json();
  const { email } = body ?? {};
  if (!email) return NextResponse.json({ error: "email é obrigatório" }, { status: 422 });
  try {
    // tenta gerar link de signup (se usuário não existe) senão magiclink
    let action_link: string | null = null;
    const origin = new URL(req.url).origin;
    try {
      const { data } = await supabase.auth.admin.generateLink({
        type: "signup",
        email,
        options: {
          data: { invited: true },
          redirectTo: `${origin}/dashboard`,
        },
      } as any);
      action_link = (data as any)?.properties?.action_link ?? (data as any)?.action_link ?? null;
    } catch {}
    if (!action_link) {
      try {
        const { data } = await supabase.auth.admin.generateLink({
          type: "magiclink",
          email,
          options: {
            redirectTo: `${origin}/dashboard`,
          },
        } as any);
        action_link = (data as any)?.properties?.action_link ?? (data as any)?.action_link ?? null;
      } catch {}
    }
    if (!action_link) {
      // fallback: tenta enviar convite padrão
      await supabase.auth.admin.inviteUserByEmail(email);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ action_link });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Falha ao gerar link de convite" }, { status: 400 });
  }
}


