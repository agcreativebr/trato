import Link from "next/link";
import { LayoutDashboard, Settings } from "lucide-react";

export function Topbar() {
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
        <nav className="text-sm text-neutral-600 flex items-center gap-2">
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
      </div>
    </div>
  );
}
