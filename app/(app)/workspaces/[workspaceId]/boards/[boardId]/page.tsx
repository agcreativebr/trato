"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-client";
import { KanbanBoard } from "@/components/KanbanBoard";
import { CardModal } from "@/components/card/CardModal";
import { useParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Popover } from "@/components/ui/Popover";
import { Modal } from "@/components/ui/Modal";
import { ArrowLeft, Trash, Check, X } from "lucide-react";

export default function BoardPage() {
  const params = useParams();
  const workspaceId = params?.workspaceId as string;
  const boardId = params?.boardId as string;
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [loading, setLoading] = useState(true);
  const [boardName, setBoardName] = useState<string>("");
  const [editingName, setEditingName] = useState(false);
  const [localName, setLocalName] = useState("");
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuBtnRef = useRef<HTMLButtonElement | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [archived, setArchived] = useState<any[]>([]);
  const [archivedQuery, setArchivedQuery] = useState("");
  const [archivedListId, setArchivedListId] = useState<string>("");
  const [archivedLists, setArchivedLists] = useState<
    { id: string; name: string }[]
  >([]);
  const [archivedOpenCardId, setArchivedOpenCardId] = useState<string | null>(
    null
  );
  const [archivedCovers, setArchivedCovers] = useState<
    Record<string, string | null>
  >({});

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        router.replace("/login");
        return;
      }
      const { data: board } = await supabase
        .from("boards")
        .select("name")
        .eq("id", boardId)
        .single();
      if (mounted) {
        setBoardName(board?.name ?? "Board");
        setLocalName(board?.name ?? "Board");
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
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  className="border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 outline-none"
                  autoFocus
                  value={localName}
                  onChange={(e) => setLocalName(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key === "Enter") {
                      setSaving(true);
                      try {
                        const name = localName.trim();
                        if (name && name !== boardName) {
                          await fetch("/api/boards", {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ id: boardId, name }),
                          });
                          setBoardName(name);
                        }
                      } finally {
                        setSaving(false);
                        setEditingName(false);
                      }
                    } else if (e.key === "Escape") {
                      setLocalName(boardName);
                      setEditingName(false);
                    }
                  }}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  isLoading={saving}
                  leftIcon={<Check size={14} />}
                  onClick={async () => {
                    setSaving(true);
                    try {
                      const name = localName.trim();
                      if (name && name !== boardName) {
                        await fetch("/api/boards", {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ id: boardId, name }),
                        });
                        setBoardName(name);
                      }
                    } finally {
                      setSaving(false);
                      setEditingName(false);
                    }
                  }}
                >
                  Salvar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<X size={14} />}
                  onClick={() => {
                    setLocalName(boardName);
                    setEditingName(false);
                  }}
                >
                  Cancelar
                </Button>
              </div>
            ) : (
              <button
                className="text-xl font-semibold text-left cursor-text"
                title="Clique para renomear"
                onClick={() => setEditingName(true)}
              >
                {boardName}
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              leftIcon={<ArrowLeft size={16} />}
              onClick={() => router.push("/dashboard")}
            >
              Voltar
            </Button>
            <button
              ref={menuBtnRef}
              className="h-9 w-9 inline-flex items-center justify-center rounded hover:bg-neutral-100"
              onClick={() => setMenuOpen(true)}
              aria-label="Menu do quadro"
              title="Menu do quadro"
            >
              ⋯
            </button>
            <Popover
              open={menuOpen}
              onClose={() => setMenuOpen(false)}
              anchorRect={menuBtnRef.current?.getBoundingClientRect()}
              width={240}
            >
              <div className="p-2 space-y-1">
                <div className="text-sm font-semibold px-2 py-1">
                  Menu do quadro
                </div>
                <button
                  className="w-full text-left px-2 py-1 hover:bg-neutral-50"
                  onClick={async () => {
                    setMenuOpen(false);
                    try {
                      // Campo archived_at pode não existir ainda; manter UI sem quebrar
                      // @ts-ignore
                      const { data } = await supabase
                        .from("cards")
                        .select("*")
                        .eq("board_id", boardId)
                        // @ts-ignore
                        .not("archived_at", "is", null);
                      setArchived(data ?? []);
                      const { data: lists } = await supabase
                        .from("lists")
                        .select("id,name")
                        .eq("board_id", boardId)
                        .order("position", { ascending: true });
                      setArchivedLists(lists ?? []);
                      // carregar thumbs de capa (se houver)
                      const coverEntries = await Promise.all(
                        (data ?? [])
                          .filter((c: any) => c.cover_path)
                          .map(async (c: any) => {
                            const { data: s } = await supabase.storage
                              .from("attachments")
                              .createSignedUrl(c.cover_path, 60 * 10);
                            return [c.id, s?.signedUrl ?? null] as const;
                          })
                      );
                      setArchivedCovers(
                        Object.fromEntries(coverEntries) as Record<
                          string,
                          string | null
                        >
                      );
                    } catch {
                      setArchived([]);
                      setArchivedLists([]);
                      setArchivedCovers({});
                    }
                    setArchivedQuery("");
                    setArchivedListId("");
                    setShowArchived(true);
                  }}
                >
                  Cartões arquivados…
                </button>
                <button
                  className="w-full text-left px-2 py-1 hover:bg-neutral-50"
                  onClick={() => {
                    setMenuOpen(false);
                    setEditingName(true);
                    setTimeout(() => {
                      // foco fica no input já que autoFocus está ativado
                    }, 0);
                  }}
                >
                  Renomear quadro…
                </button>
                <button
                  className="w-full text-left px-2 py-1 hover:bg-neutral-50 text-red-600"
                  onClick={async () => {
                    setMenuOpen(false);
                    if (
                      !confirm("Excluir este quadro? Esta ação é permanente.")
                    )
                      return;
                    await fetch("/api/boards", {
                      method: "DELETE",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ id: boardId }),
                    });
                    router.push("/dashboard");
                  }}
                >
                  Excluir quadro
                </button>
              </div>
            </Popover>
          </div>
        </div>
      </div>
      <KanbanBoard boardId={boardId} workspaceId={workspaceId} />
      <Modal open={showArchived} onClose={() => setShowArchived(false)}>
        <div className="p-4 w-[980px] max-w-[98vw] relative">
          <button
            className="absolute top-2 right-2 h-8 w-8 inline-flex items-center justify-center rounded hover:bg-neutral-100"
            aria-label="Fechar"
            onClick={() => setShowArchived(false)}
          >
            ×
          </button>
          <div className="mx-auto max-w-none px-2 md:px-0">
            <div className="text-lg font-semibold mb-3 md:text-left text-center">
              Cartões arquivados
            </div>
            <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-3">
              <input
                className="flex-1 min-w-[260px] border rounded px-3 py-2 text-sm"
                placeholder="Buscar por título…"
                value={archivedQuery}
                onChange={(e) => setArchivedQuery(e.target.value)}
              />
              <select
                className="w-52 border rounded px-2 py-2 text-sm"
                value={archivedListId}
                onChange={(e) => setArchivedListId(e.target.value)}
              >
                <option value="">Todas as listas</option>
                {archivedLists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
              <div className="ml-auto flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={async () => {
                    // bulk restore
                    const ids = archived
                      .filter((c) =>
                        archivedQuery
                          ? (c.title ?? "")
                              .toLowerCase()
                              .includes(archivedQuery.toLowerCase())
                          : true
                      )
                      .filter((c) =>
                        archivedListId ? c.list_id === archivedListId : true
                      )
                      .map((c) => c.id);
                    if (!ids.length) return;
                    await getSupabaseBrowserClient()
                      .from("cards")
                      .update({ archived_at: null })
                      .in("id", ids);
                    setArchived((prev) =>
                      prev.filter((c) => !ids.includes(c.id))
                    );
                  }}
                >
                  Restaurar todos
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    const ids = archived
                      .filter((c) =>
                        archivedQuery
                          ? (c.title ?? "")
                              .toLowerCase()
                              .includes(archivedQuery.toLowerCase())
                          : true
                      )
                      .filter((c) =>
                        archivedListId ? c.list_id === archivedListId : true
                      )
                      .map((c) => c.id);
                    if (!ids.length) return;
                    if (
                      !confirm(
                        `Excluir permanentemente ${ids.length} cartão(ões)? Essa ação não pode ser desfeita.`
                      )
                    )
                      return;
                    const sb = getSupabaseBrowserClient();
                    try {
                      const { data: cls } = await sb
                        .from("checklists")
                        .select("id")
                        .in("card_id", ids);
                      const checkIds = (cls ?? []).map((x: any) => x.id);
                      if (checkIds.length) {
                        await sb
                          .from("checklist_items")
                          .delete()
                          .in("checklist_id", checkIds);
                        await sb.from("checklists").delete().in("id", checkIds);
                      }
                      await sb
                        .from("card_comments")
                        .delete()
                        .in("card_id", ids);
                      await sb.from("card_labels").delete().in("card_id", ids);
                      await sb.from("attachments").delete().in("card_id", ids);
                      await sb.from("cards").delete().in("id", ids);
                    } finally {
                      setArchived((prev) =>
                        prev.filter((c) => !ids.includes(c.id))
                      );
                    }
                  }}
                >
                  Excluir todos
                </Button>
              </div>
            </div>
            {archived.length === 0 ? (
              <p className="text-sm text-neutral-600">
                Nenhum cartão arquivado encontrado.
              </p>
            ) : (
              <div className="space-y-2 max-h-[60vh] overflow-auto">
                {archived
                  .filter((c) =>
                    archivedQuery
                      ? (c.title ?? "")
                          .toLowerCase()
                          .includes(archivedQuery.toLowerCase())
                      : true
                  )
                  .filter((c) =>
                    archivedListId ? c.list_id === archivedListId : true
                  )
                  .map((c) => (
                    <div
                      key={c.id}
                      className="w-full border border-neutral-200 rounded-lg bg-white px-3 py-2 grid grid-cols-[auto_1fr_auto] gap-3 items-center cursor-pointer hover:bg-neutral-50 shadow-sm"
                      onClick={() => setArchivedOpenCardId(c.id)}
                    >
                      {archivedCovers[c.id] ? (
                        <img
                          src={archivedCovers[c.id] as string}
                          alt="capa"
                          className="w-16 h-10 object-cover rounded"
                        />
                      ) : (
                        <div className="w-16 h-10 rounded bg-neutral-100" />
                      )}
                      <div className="min-w-0">
                        <div className="font-medium truncate">{c.title}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-neutral-100 text-neutral-700 border border-neutral-200">
                            {archivedLists.find((l) => l.id === c.list_id)
                              ?.name ?? "—"}
                          </span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-neutral-100 text-neutral-700 border border-neutral-200">
                            {new Date(
                              c.updated_at ?? c.created_at
                            ).toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button
                          className="text-sm px-3 py-1 rounded border hover:bg-neutral-50"
                          onClick={async (e) => {
                            e.stopPropagation();
                            await getSupabaseBrowserClient()
                              .from("cards")
                              .update({ archived_at: null })
                              .eq("id", c.id);
                            // remove localmente
                            setArchived((prev) =>
                              prev.filter((x) => x.id !== c.id)
                            );
                          }}
                        >
                          Restaurar
                        </button>
                        <button
                          className="text-sm px-3 py-1 rounded border hover:bg-red-50 text-red-600"
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (
                              !confirm("Excluir permanentemente este cartão?")
                            )
                              return;
                            try {
                              const sb = getSupabaseBrowserClient();
                              const { data: cls } = await sb
                                .from("checklists")
                                .select("id")
                                .eq("card_id", c.id);
                              const ids = (cls ?? []).map((x: any) => x.id);
                              if (ids.length) {
                                await sb
                                  .from("checklist_items")
                                  .delete()
                                  .in("checklist_id", ids);
                                await sb
                                  .from("checklists")
                                  .delete()
                                  .in("id", ids);
                              }
                              await sb
                                .from("card_comments")
                                .delete()
                                .eq("card_id", c.id);
                              await sb
                                .from("card_labels")
                                .delete()
                                .eq("card_id", c.id);
                              await sb
                                .from("attachments")
                                .delete()
                                .eq("card_id", c.id);
                              await sb.from("cards").delete().eq("id", c.id);
                            } finally {
                              setArchived((prev) =>
                                prev.filter((x) => x.id !== c.id)
                              );
                            }
                          }}
                        >
                          Excluir
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </Modal>
      <CardModal
        open={!!archivedOpenCardId}
        boardId={boardId}
        cardId={archivedOpenCardId ?? ""}
        onClose={() => setArchivedOpenCardId(null)}
      />
    </div>
  );
}
