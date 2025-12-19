'use client';

import { useEffect, useMemo, useState } from "react";

function summarizeActivity(a: { action: string; payload: any }) {
  const act = a.action || "";
  const p = a.payload || {};
  if (act === "created") return "criou o cartão";
  if (act === "updated") return "atualizou o cartão";
  if (act === "moved") {
    const from = p.from_list_name || p.from_list_id || "lista anterior";
    const to = p.to_list_name || p.list_id || p.to_list_id || "lista";
    return `moveu o cartão de “${from}” para “${to}”`;
  }
  if (act === "dates_updated") return "atualizou as datas";
  if (act === "label.added") return `adicionou a etiqueta${p?.label_name ? ` “${p.label_name}”` : ""}`;
  if (act === "label.removed") return `removeu a etiqueta${p?.label_name ? ` “${p.label_name}”` : ""}`;
  if (act === "checklist.completed") return "concluiu um checklist";
  if (act === "checklist.item_toggled") return "marcou/desmarcou um item";
  if (act === "checklist.item_renamed") return "renomeou um item do checklist";
  if (act === "cover.changed") return "alterou a capa";
  if (act === "attachment.added") return "adicionou um anexo";
  if (act === "member.added") return "atribuiu um membro";
  if (act === "member.removed") return "removeu um membro";
  if (act === "card.archived") return "arquivou o cartão";
  if (act === "card.restored") return "restaurou o cartão";
  if (act === "card.deleted") return "excluiu o cartão";
  if (act === "list.updated") return "atualizou uma lista";
  if (act === "list.moved") {
    const name = p.list_name || p.list_id || "lista";
    const toIdx = typeof p.to_index === "number" ? ` (pos. ${p.to_index + 1})` : "";
    return `moveu a lista “${name}”${toIdx}`;
  }
  if (act === "board.updated") return "atualizou o quadro";
  return act;
}

function timeAgo(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h} horas`;
  const ddd = Math.floor(h / 24);
  return `há ${ddd} dias`;
}

export function ActivityPanel({ boardId, open, onClose }: { boardId: string; open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<"all" | "comments">("all");
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!open) return;
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/boards/audit?board_id=${boardId}`);
        const json = await res.json();
        if (!mounted) return;
        setRows(json?.data ?? []);
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [open, boardId]);
  const filtered = useMemo(() => {
    if (tab === "comments") {
      return (rows ?? []).filter((r: any) => r.action === "comment.posted");
    }
    return rows ?? [];
  }, [rows, tab]);
  return (
    <div className="p-4 w-full max-w-[1100px]">
      <div className="flex items-center justify-between mb-2">
        <div className="text-base font-semibold">Atividade</div>
        <button className="h-8 w-8 rounded hover:bg-neutral-100" onClick={onClose}>×</button>
      </div>
      <div className="flex items-center gap-2 mb-2">
        <button
          className={`px-2 py-1 text-sm rounded ${tab === "all" ? "bg-blue-100 text-blue-700" : "hover:bg-neutral-100"}`}
          onClick={() => setTab("all")}
        >
          Tudo
        </button>
        <button
          className={`px-2 py-1 text-sm rounded ${tab === "comments" ? "bg-blue-100 text-blue-700" : "hover:bg-neutral-100"}`}
          onClick={() => setTab("comments")}
        >
          Comentários
        </button>
      </div>
      <div className="max-h-[70vh] overflow-auto pr-1">
        {loading ? (
          <div className="text-sm text-neutral-600 px-2 py-2">Carregando…</div>
        ) : filtered.length === 0 ? (
          <div className="text-sm text-neutral-500 px-2 py-2">Sem atividades.</div>
        ) : (
          <div className="space-y-3">
            {filtered.map((r: any) => (
              <div
                key={`${r.timestamp}-${r.card_id ?? "board"}-${r.action}`}
                className="grid grid-cols-[auto_1fr_auto] items-start gap-3 px-1"
              >
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-fuchsia-500 to-violet-600 text-white grid place-items-center text-xs font-bold">
                  {String(r.actor_name ?? "?").slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-sm">
                    <span className="font-medium">{r.actor_name ?? r.actor_id ?? "Alguém"}</span>{" "}
                    <span>{summarizeActivity({ action: r.action, payload: r.payload })}</span>
                  </div>
                </div>
                <div className="text-xs text-neutral-500 whitespace-nowrap">{timeAgo(r.timestamp)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

