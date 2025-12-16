'use client';

import Link from "next/link";
import { LayoutDashboard, Settings } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-client";
import { Avatar } from "@/components/ui/Avatar";

export function Topbar() {
  const supabase = useMemo(() => getSupabaseBrowserClient() as any, []);
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<{ display_name?: string | null; avatar_url?: string | null } | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      setUser(data.user ?? null);
      try {
        if (data.user?.id) {
          const { data: prof } = await supabase
            .from("user_profiles")
            .select("display_name, avatar_url")
            .eq("id", data.user.id)
            .maybeSingle();
          if (mounted) setProfile(prof ?? null);
        }
      } catch {}
    })();
    return () => {
      mounted = false;
    };
  }, [supabase]);

  return (
    <div className="sticky top-0 z-40 bg-white/70 backdrop-blur border-b">
      <div className="mx-auto max-w-7xl px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 grid place-items-center rounded-md bg-gradient-to-br from-sky-500 to-indigo-500 text-white shadow-sm">
            <LayoutDashboard size={16} />
          </div>
          <Link href="/dashboard" className="font-semibold tracking-tight">
            KanbanPro
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <nav className="text-sm text-neutral-600 hidden md:flex items-center gap-2">
            <Link
              className="hover:text-neutral-900 px-2 py-1 rounded-md hover:bg-neutral-100"
              href="/dashboard"
            >
              Dashboard
            </Link>
            <Link
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md border hover:bg-neutral-50"
              href="/settings"
            >
              <Settings size={14} /> <span>Configurações</span>
            </Link>
          </nav>
          <button
            className="h-9 w-9 inline-flex items-center justify-center rounded-full border hover:bg-neutral-50"
            title={profile?.display_name ?? user?.email ?? "Minha conta"}
            onClick={async () => {
              // simples: se sem sessão, ir ao login; se com sessão, abrir menu rápido de sair
              if (!user) {
                location.href = "/login";
              } else {
                const sure = confirm("Sair da conta?");
                if (sure) {
                  await supabase.auth.signOut();
                  location.href = "/login";
                }
              }
            }}
          >
            <Avatar
              size={28}
              src={profile?.avatar_url ?? undefined}
              name={profile?.display_name ?? (user?.email as string | undefined)}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
