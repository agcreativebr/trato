'use client';

import Link from "next/link";
import { LayoutDashboard, Settings } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-client";
import { Avatar } from "@/components/ui/Avatar";
import { Popover } from "@/components/ui/Popover";
import * as React from "react";

export function Topbar() {
  const supabase = useMemo(() => getSupabaseBrowserClient() as any, []);
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<{ display_name?: string | null; avatar_url?: string | null } | null>(null);
  const btnRef = React.useRef<HTMLButtonElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuView, setMenuView] = useState<'root' | 'workspaces'>('root');
  const [workspaces, setWorkspaces] = useState<{ id: string; name: string }[]>([]);
  const [wsLoading, setWsLoading] = useState(false);

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
            ref={btnRef}
            onClick={() => {
              if (!user) {
                location.href = "/login";
                return;
              }
              setMenuView('root');
              setMenuOpen(true);
            }}
          >
            <Avatar
              size={28}
              src={profile?.avatar_url ?? undefined}
              name={profile?.display_name ?? (user?.email as string | undefined)}
            />
          </button>
          <Popover
            open={menuOpen}
            onClose={() => setMenuOpen(false)}
            anchorRect={btnRef.current?.getBoundingClientRect()}
            width={320}
          >
            {menuView === 'root' ? (
              <div className="p-2 space-y-2">
                <div className="flex items-center gap-2 px-2 py-1">
                  <Avatar size={28} src={profile?.avatar_url ?? undefined} name={profile?.display_name ?? user?.email ?? undefined} />
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{profile?.display_name ?? user?.email ?? 'Minha conta'}</div>
                    <div className="text-xs text-neutral-500 truncate">{user?.email ?? ''}</div>
                  </div>
                </div>
                <div className="border-t my-1" />
                <button
                  className="w-full text-left px-2 py-1 rounded hover:bg-neutral-50 text-sm"
                  onClick={() => {
                    setMenuOpen(false);
                    location.href = '/dashboard';
                  }}
                >
                  Ir ao Dashboard
                </button>
                <button
                  className="w-full text-left px-2 py-1 rounded hover:bg-neutral-50 text-sm"
                  onClick={() => {
                    setMenuOpen(false);
                    location.href = '/settings';
                  }}
                >
                  Configurações
                </button>
                <button
                  className="w-full text-left px-2 py-1 rounded hover:bg-neutral-50 text-sm"
                  onClick={async () => {
                    setMenuView('workspaces');
                    setWsLoading(true);
                    try {
                      const { data: ws } = await supabase.from('workspaces').select('id,name').order('created_at', { ascending: false });
                      setWorkspaces((ws ?? []) as any);
                    } finally {
                      setWsLoading(false);
                    }
                  }}
                >
                  Workspaces…
                </button>
                <button
                  className="w-full text-left px-2 py-1 rounded hover:bg-neutral-50 text-sm"
                  onClick={async () => {
                    const name = prompt('Nome do novo workspace:')?.trim();
                    if (!name) return;
                    await supabase.from('workspaces').insert({ name } as any);
                    alert('Workspace criado.');
                    setMenuOpen(false);
                  }}
                >
                  Criar workspace
                </button>
                <div className="border-t my-1" />
                <button
                  className="w-full text-left px-2 py-1 rounded hover:bg-neutral-50 text-sm text-red-600"
                  onClick={async () => {
                    await supabase.auth.signOut();
                    location.href = '/login';
                  }}
                >
                  Sair
                </button>
              </div>
            ) : null}

            {menuView === 'workspaces' ? (
              <div className="p-2 space-y-2">
                <div className="flex items-center justify-between px-1">
                  <button className="text-sm" onClick={() => setMenuView('root')}>‹</button>
                  <div className="text-sm font-medium">Workspaces</div>
                  <button className="text-sm" onClick={() => setMenuOpen(false)}>×</button>
                </div>
                {wsLoading ? (
                  <div className="text-sm text-neutral-600 px-2 py-1">Carregando…</div>
                ) : workspaces.length === 0 ? (
                  <div className="text-sm text-neutral-600 px-2 py-1">Nenhum workspace.</div>
                ) : (
                  <div className="max-h-64 overflow-auto">
                    {workspaces.map((w) => (
                      <button
                        key={w.id}
                        className="w-full text-left px-2 py-2 rounded hover:bg-neutral-50 text-sm"
                        onClick={() => {
                          setMenuOpen(false);
                          location.href = '/dashboard';
                        }}
                        title={w.name}
                      >
                        {w.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </Popover>
        </div>
      </div>
    </div>
  );
}
