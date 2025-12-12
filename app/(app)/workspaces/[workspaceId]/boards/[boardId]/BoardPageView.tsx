"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-client";
import { KanbanBoard } from "@/components/KanbanBoard";
import { CardModal } from "@/components/card/CardModal";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Popover } from "@/components/ui/Popover";
import { Modal } from "@/components/ui/Modal";
import { ArrowLeft, Check, X } from "lucide-react";

type ActionDraft =
  | { type: "add_label"; label_id?: string }
  | { type: "assign_member"; user_id?: string }
  | { type: "remove_member"; user_id?: string }
  | { type: "move_to_list"; list_id?: string }
  | { type: "set_start_date"; when?: "now" }
  | { type: "shift_due_by_days"; days?: number }
  | { type: "create_checklist"; title?: string; itemsText?: string }
  | { type: "comment"; text?: string }
  | { type: "move_to_top" }
  | { type: "move_to_bottom" }
  | { type: "archive_now" };

export default function BoardPageView() {
  const params = useParams();
  const workspaceId = params?.workspaceId as string;
  const boardId = params?.boardId as string;
  const supabase = useMemo(() => getSupabaseBrowserClient() as any, []);
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
  const [archivedLists, setArchivedLists] = useState<{ id: string; name: string }[]>([]);
  const [archivedOpenCardId, setArchivedOpenCardId] = useState<string | null>(null);
  const [archivedCovers, setArchivedCovers] = useState<Record<string, string | null>>({});
  const [showAutomations, setShowAutomations] = useState(false);
  const [automations, setAutomations] = useState<any[]>([]);
  const [autoLoading, setAutoLoading] = useState(false);
  const [autoName, setAutoName] = useState("");
  const [autoEvent, setAutoEvent] = useState<
    | "card.moved"
    | "card.created"
    | "label.added"
    | "checklist.completed"
    | "comment.posted"
    | "attachment.added"
    | "cover.changed"
    | "due.changed"
    | "start.changed"
    | "card.archived"
    | "card.restored"
  >("card.moved");
  const [autoTab, setAutoTab] = useState<
    "move" | "changes" | "dates" | "checklists" | "content" | "fields"
  >("move");
  const [autoToList, setAutoToList] = useState<string>("");
  const [autoLabel, setAutoLabel] = useState<string>("");
  const [autoTriggerLabel, setAutoTriggerLabel] = useState<string>("");
  const [autoLists, setAutoLists] = useState<{ id: string; name: string }[]>([]);
  const [autoLabels, setAutoLabels] = useState<{ id: string; name: string; color: string }[]>(
    []
  );
  const [autoMembers, setAutoMembers] = useState<{ id: string; name: string | null }[]>([]);
  const [autoActions, setAutoActions] = useState<ActionDraft[]>([]);

  // Mapas auxiliares para nomes
  const listNameById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const l of autoLists) m[l.id] = l.name;
    return m;
  }, [autoLists]);
  const labelNameById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const l of autoLabels) m[l.id] = l.name;
    return m;
  }, [autoLabels]);

  useEffect(() => {
    if (!showAutomations) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setShowAutomations(false);
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true } as any);
  }, [showAutomations]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        router.replace("/login");
        return;
      }
      const { data: board } = await supabase.from("boards").select("name").eq("id", boardId).single();
      if (mounted) {
        const bname = (board as any)?.name ?? "Board";
        setBoardName(bname);
        setLocalName(bname);
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [boardId, supabase, router]);

  if (loading) {
    return <div className="p-6">Carregando...</div>;
  }

  // Resumos legíveis (PT-BR) com contexto
  function summarizeTriggerDetailed(cfg: any): string {
    const ev = cfg?.event;
    if (ev === "card.moved") {
      const list = cfg?.to_list_id ? (listNameById[cfg.to_list_id] ?? "lista destino") : "qualquer lista";
      return `Quando mover o cartão para “${list}”`;
    }
    if (ev === "card.created") {
      if (!cfg?.in_list_id) return "Quando o cartão for criado no quadro";
      const list = listNameById[cfg.in_list_id] ?? "lista";
      return `Quando o cartão for criado em “${list}”`;
    }
    if (ev === "label.added") {
      const lab = cfg?.label_id ? (labelNameById[cfg.label_id] ?? "etiqueta") : "alguma etiqueta";
      return `Quando a etiqueta “${lab}” for adicionada ao cartão`;
    }
    if (ev === "checklist.completed") return "Quando um checklist do cartão for concluído";
    if (ev === "due.changed") return "Quando a data de entrega do cartão mudar";
    if (ev === "start.changed") return "Quando a data de início do cartão mudar";
    if (ev === "comment.posted") return "Quando um comentário for publicado no cartão";
    if (ev === "attachment.added") return "Quando um anexo for adicionado no cartão";
    if (ev === "cover.changed") return "Quando a capa do cartão mudar";
    if (ev === "card.archived") return "Quando o cartão for arquivado";
    if (ev === "card.restored") return "Quando o cartão for restaurado";
    if (ev === "card.deleted") return "Quando o cartão for excluído";
    return String(ev ?? "Evento");
  }
  function summarizeActionDetailed(a: any): string {
    if (!a) return "";
    if (a.type === "add_label") {
      const name = a.label_id ? (labelNameById[a.label_id] ?? "etiqueta") : "etiqueta";
      return `adicionar etiqueta “${name}”`;
    }
    if (a.type === "assign_member") return "atribuir membro";
    if (a.type === "remove_member") return "remover membro";
    if (a.type === "move_to_list") {
      const name = a.list_id ? (listNameById[a.list_id] ?? "lista") : "lista";
      return `mover para “${name}”`;
    }
    if (a.type === "set_start_date") return "definir início";
    if (a.type === "shift_due_by_days") return `ajustar entrega em ${a.days ?? 0} dia(s)`;
    if (a.type === "create_checklist") return `criar checklist “${a.title ?? "Checklist"}”`;
    if (a.type === "comment") return `comentar “${(a.text ?? "").toString().slice(0, 40)}”`;
    if (a.type === "archive_now") return "arquivar cartão";
    if (a.type === "move_to_top") return "mover para o topo";
    if (a.type === "move_to_bottom") return "mover para o fim";
    return a.type;
  }

  return (
    <div className="h-full flex flex-col overflow-hidden pb-2">
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
            <Button variant="ghost" leftIcon={<ArrowLeft size={16} />} onClick={() => router.push("/dashboard")}>
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
                <div className="text-sm font-semibold px-2 py-1">Menu do quadro</div>
                <button
                  className="w-full text-left px-2 py-1 hover:bg-neutral-50"
                  onClick={async () => {
                    setMenuOpen(false);
                    try {
                      // @ts-ignore
                      const { data } = await supabase.from("cards").select("*").eq("board_id", boardId).not("archived_at", "is", null);
                      setArchived(data ?? []);
                      const { data: lists } = await supabase
                        .from("lists")
                        .select("id,name")
                        .eq("board_id", boardId)
                        .order("position", { ascending: true });
                      setArchivedLists(lists ?? []);
                      const coverEntries = await Promise.all(
                        (data ?? [])
                          .filter((c: any) => c.cover_path)
                          .map(async (c: any) => {
                            const { data: s } = await supabase.storage.from("attachments").createSignedUrl(c.cover_path, 60 * 10);
                            return [c.id, s?.signedUrl ?? null] as const;
                          })
                      );
                      setArchivedCovers(Object.fromEntries(coverEntries) as Record<string, string | null>);
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
                  onClick={async () => {
                    setMenuOpen(false);
                    setShowAutomations(true);
                    setAutoLoading(true);
                    try {
                      const [ls, labs, autos, members] = await Promise.all([
                        supabase.from("lists").select("id,name").eq("board_id", boardId).order("position", { ascending: true }),
                        supabase.from("labels").select("id,name,color").eq("board_id", boardId),
                        fetch(`/api/automations?board_id=${boardId}`).then((r) => r.json()),
                        supabase.from("user_profiles").select("id, display_name").order("display_name", { ascending: true }),
                      ]);
                      const lsData: any[] = (ls as any).data ?? [];
                      const labsData: any[] = (labs as any).data ?? [];
                      const autosData: any[] = (autos as any).data ?? [];
                      const membersData: any[] = (members as any).data ?? [];
                      setAutoLists(lsData);
                      setAutoLabels(labsData);
                      setAutomations(autosData);
                      setAutoToList(lsData?.[0]?.id ?? "");
                      setAutoLabel(labsData?.[0]?.id ?? "");
                      setAutoMembers(membersData.map((m: any) => ({ id: m.id, name: m.display_name ?? null })));
                      setAutoActions((prev) =>
                        prev.length ? prev : [{ type: "add_label", label_id: labsData?.[0]?.id } as any]
                      );
                    } finally {
                      setAutoLoading(false);
                    }
                  }}
                >
                  Automações…
                </button>
                <button
                  className="w-full text-left px-2 py-1 hover:bg-neutral-50"
                  onClick={() => {
                    setMenuOpen(false);
                    setEditingName(true);
                  }}
                >
                  Renomear quadro…
                </button>
                <button
                  className="w-full text-left px-2 py-1 hover:bg-neutral-50 text-red-600"
                  onClick={async () => {
                    setMenuOpen(false);
                    if (!confirm("Excluir este quadro? Esta ação é permanente.")) return;
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

      <div className="flex-1 min-h-0">
        <KanbanBoard boardId={boardId} workspaceId={workspaceId} />
      </div>

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
            <div className="text-lg font-semibold mb-3 md:text-left text-center">Cartões arquivados</div>
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
                    const ids = archived
                      .filter((c) =>
                        archivedQuery ? (c.title ?? "").toLowerCase().includes(archivedQuery.toLowerCase()) : true
                      )
                      .filter((c) => (archivedListId ? c.list_id === archivedListId : true))
                      .map((c) => c.id);
                    if (!ids.length) return;
                    await (getSupabaseBrowserClient() as any).from("cards").update({ archived_at: null } as any).in("id", ids);
                    setArchived((prev) => prev.filter((c) => !ids.includes(c.id)));
                    // emitir evento de restauração para o primeiro cartão (evitar flood)
                    try {
                      if (ids[0]) {
                        await fetch("/api/automations/emit", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ type: "card.restored", card_id: ids[0] }),
                        });
                      }
                    } catch {}
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
                        archivedQuery ? (c.title ?? "").toLowerCase().includes(archivedQuery.toLowerCase()) : true
                      )
                      .filter((c) => (archivedListId ? c.list_id === archivedListId : true))
                      .map((c) => c.id);
                    if (!ids.length) return;
                    if (!confirm(`Excluir permanentemente ${ids.length} cartão(ões)? Essa ação não pode ser desfeita.`)) return;
                    const sb = getSupabaseBrowserClient();
                    try {
                      const { data: cls } = await sb.from("checklists").select("id").in("card_id", ids);
                      const checkIds = (cls ?? []).map((x: any) => x.id);
                      if (checkIds.length) {
                        await sb.from("checklist_items").delete().in("checklist_id", checkIds);
                        await sb.from("checklists").delete().in("id", checkIds);
                      }
                      await sb.from("card_comments").delete().in("card_id", ids);
                      await sb.from("card_labels").delete().in("card_id", ids);
                      await sb.from("attachments").delete().in("card_id", ids);
                      await sb.from("cards").delete().in("id", ids);
                      // Dispara um evento para o primeiro cartão (evitar flood)
                      try {
                        if (ids[0]) {
                          await fetch("/api/automations/emit", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ type: "card.deleted", card_id: ids[0] }),
                          });
                        }
                      } catch {}
                    } finally {
                      setArchived((prev) => prev.filter((c) => !ids.includes(c.id)));
                    }
                  }}
                >
                  Excluir todos
                </Button>
              </div>
            </div>

            {archived.length === 0 ? (
              <p className="text-sm text-neutral-600">Nenhum cartão arquivado encontrado.</p>
            ) : (
              <div className="space-y-2 max-h-[60vh] overflow-auto">
                {archived
                  .filter((c) =>
                    archivedQuery ? (c.title ?? "").toLowerCase().includes(archivedQuery.toLowerCase()) : true
                  )
                  .filter((c) => (archivedListId ? c.list_id === archivedListId : true))
                  .map((c) => (
                    <div
                      key={c.id}
                      className="w-full border border-neutral-200 rounded-lg bg-white px-3 py-2 grid grid-cols-[auto_1fr_auto] gap-3 items-center cursor-pointer hover:bg-neutral-50 shadow-sm"
                      onClick={() => setArchivedOpenCardId(c.id)}
                    >
                      {archivedCovers[c.id] ? (
                        <img src={archivedCovers[c.id] as string} alt="capa" className="w-16 h-10 object-cover rounded" />
                      ) : (
                        <div className="w-16 h-10 rounded bg-neutral-100" />
                      )}
                      <div className="min-w-0">
                        <div className="font-medium truncate">{c.title}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-neutral-100 text-neutral-700 border border-neutral-200">
                            {archivedLists.find((l) => l.id === c.list_id)?.name ?? "—"}
                          </span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-neutral-100 text-neutral-700 border border-neutral-200">
                            {new Date(c.updated_at ?? c.created_at).toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button
                          className="text-sm px-3 py-1 rounded border hover:bg-neutral-50"
                          onClick={async (e) => {
                            e.stopPropagation();
                            await (getSupabaseBrowserClient() as any).from("cards").update({ archived_at: null } as any).eq("id", c.id);
                            setArchived((prev) => prev.filter((x) => x.id !== c.id));
                            try {
                              await fetch("/api/automations/emit", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ type: "card.restored", card_id: c.id }),
                              });
                            } catch {}
                          }}
                        >
                          Restaurar
                        </button>
                        <button
                          className="text-sm px-3 py-1 rounded border hover:bg-red-50 text-red-600"
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (!confirm("Excluir permanentemente este cartão?")) return;
                            try {
                              const sb = getSupabaseBrowserClient();
                              const { data: cls } = await sb.from("checklists").select("id").eq("card_id", c.id);
                              const ids = (cls ?? []).map((x: any) => x.id);
                              if (ids.length) {
                                await sb.from("checklist_items").delete().in("checklist_id", ids);
                                await sb.from("checklists").delete().in("id", ids);
                              }
                              await sb.from("card_comments").delete().eq("card_id", c.id);
                              await sb.from("card_labels").delete().eq("card_id", c.id);
                              await sb.from("attachments").delete().eq("card_id", c.id);
                              await sb.from("cards").delete().eq("id", c.id);
                              try {
                                await fetch("/api/automations/emit", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ type: "card.deleted", card_id: c.id }),
                                });
                              } catch {}
                            } finally {
                              setArchived((prev) => prev.filter((x) => x.id !== c.id));
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

      {/* Automations Modal */}
      <Modal open={showAutomations} onClose={() => setShowAutomations(false)}>
        <div className="p-4 w-[980px] max-w-[98vw] relative">
          <button
            className="absolute top-2 right-2 h-8 w-8 inline-flex items-center justify-center rounded hover:bg-neutral-100"
            aria-label="Fechar"
            onClick={() => setShowAutomations(false)}
          >
            ×
          </button>
          <div className="mx-auto max-w-none px-2 md:px-0">
            <div className="text-lg font-semibold mb-3 md:text-left text-center">Automações do quadro</div>
            <div className="mb-4 space-y-2 border rounded-md p-3 bg-white">
              <div className="text-sm font-medium">Criar regra (exemplo)</div>
              {/* Abas de gatilhos */}
              <div className="flex flex-wrap gap-2">
                {([
                  ["move", "Mover cartão"],
                  ["changes", "Alterações"],
                  ["dates", "Datas"],
                  ["checklists", "Checklists"],
                  ["content", "Conteúdo"],
                  ["fields", "Campos"],
                ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    className={`px-3 py-1 rounded border text-sm ${
                      autoTab === key ? "bg-neutral-100 border-neutral-300" : "hover:bg-neutral-50"
                    }`}
                    onClick={() => {
                      setAutoTab(key);
                      // define um evento padrão por aba
                      if (key === "move") setAutoEvent("card.moved");
                      else if (key === "changes") setAutoEvent("card.archived");
                      else if (key === "dates") setAutoEvent("due.changed");
                      else if (key === "checklists") setAutoEvent("checklist.completed");
                      else if (key === "content") setAutoEvent("comment.posted");
                      else setAutoEvent("card.moved");
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr] gap-3">
                <input
                  className="border rounded px-3 py-2 text-sm"
                  placeholder="Nome da regra"
                  value={autoName}
                  onChange={(e) => setAutoName(e.target.value)}
                />
                {/* Seletor de evento por aba */}
                {autoTab === "move" && (
                  <select
                    className="border rounded px-2 py-2 text-sm"
                    value={autoEvent}
                    onChange={(e) => setAutoEvent(e.target.value as any)}
                  >
                    <option value="card.moved">Quando mover para</option>
                    <option value="card.created">Quando for criado em</option>
                  </select>
                )}
                {autoTab === "changes" && (
                  <select
                    className="border rounded px-2 py-2 text-sm"
                    value={autoEvent}
                    onChange={(e) => setAutoEvent(e.target.value as any)}
                  >
                    <option value="card.archived">Quando for arquivado</option>
                    <option value="card.restored">Quando for restaurado</option>
                    <option value="label.added">Quando etiqueta for adicionada</option>
                    <option value="attachment.added">Quando anexo for adicionado</option>
                    <option value="cover.changed">Quando a capa mudar</option>
                  </select>
                )}
                {autoTab === "dates" && (
                  <select
                    className="border rounded px-2 py-2 text-sm"
                    value={autoEvent}
                    onChange={(e) => setAutoEvent(e.target.value as any)}
                  >
                    <option value="due.changed">Quando a entrega mudar</option>
                    <option value="start.changed">Quando o início mudar</option>
                  </select>
                )}
                {autoTab === "checklists" && (
                  <select
                    className="border rounded px-2 py-2 text-sm"
                    value={autoEvent}
                    onChange={(e) => setAutoEvent(e.target.value as any)}
                  >
                    <option value="checklist.completed">Quando checklist concluir</option>
                  </select>
                )}
                {autoTab === "content" && (
                  <select
                    className="border rounded px-2 py-2 text-sm"
                    value={autoEvent}
                    onChange={(e) => setAutoEvent(e.target.value as any)}
                  >
                    <option value="comment.posted">Quando um comentário for publicado</option>
                  </select>
                )}
                <select
                  className="border rounded px-2 py-2 text-sm"
                  value={autoToList}
                  onChange={(e) => setAutoToList(e.target.value)}
                >
                  {autoEvent === "card.created" && <option value="*">No quadro (qualquer lista)</option>}
                  {autoLists.map((l) => (
                    <option key={l.id} value={l.id}>
                      {autoEvent === "card.moved" ? `Lista alvo: ${l.name}` : `Lista de criação: ${l.name}`}
                    </option>
                  ))}
                </select>
                {/* Campo auxiliar quando o evento for label.added */}
                {autoEvent === "label.added" && (
                  <select
                    className="border rounded px-2 py-2 text-sm"
                    value={autoTriggerLabel || autoLabels[0]?.id || ""}
                    onChange={(e) => setAutoTriggerLabel(e.target.value)}
                  >
                    {autoLabels.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                )}
                <div className="md:col-span-2 border rounded p-2 space-y-2">
                  <div className="text-xs font-medium text-neutral-700">Ações (executadas em ordem):</div>
                  {autoActions.map((act, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-1 md:grid-cols-[180px_1fr_auto] gap-2 items-center border rounded p-2 bg-neutral-50"
                    >
                      <select
                        className="border rounded px-2 py-2 text-sm"
                        value={(act as any).type}
                        onChange={(e) => {
                          const type = e.target.value as any;
                          setAutoActions((prev) => {
                            const copy = [...prev] as any[];
                            const base =
                              type === "add_label"
                                ? { type, label_id: autoLabels[0]?.id }
                                : type === "assign_member" || type === "remove_member"
                                ? { type, user_id: autoMembers[0]?.id }
                                : type === "move_to_list"
                                ? { type, list_id: autoLists[0]?.id }
                                : type === "set_start_date"
                                ? { type, when: "now" }
                                : type === "shift_due_by_days"
                                ? { type, days: 1 }
                                : type === "create_checklist"
                                ? { type, title: "Checklist", itemsText: "" }
                                : type === "comment"
                                ? { type, text: "" }
                                : { type };
                            copy[idx] = base;
                            return copy as any;
                          });
                        }}
                      >
                        <option value="add_label">Adicionar etiqueta</option>
                        <option value="assign_member">Atribuir membro</option>
                        <option value="remove_member">Remover membro</option>
                        <option value="move_to_list">Mover para lista</option>
                        <option value="move_to_top">Mover para o topo</option>
                        <option value="move_to_bottom">Mover para o fim</option>
                        <option value="set_start_date">Definir início</option>
                        <option value="shift_due_by_days">Ajustar entrega (dias)</option>
                        <option value="create_checklist">Criar checklist</option>
                        <option value="comment">Comentar</option>
                        <option value="archive_now">Arquivar</option>
                      </select>
                      <div className="flex flex-wrap gap-2">
                        {"label_id" in act && (
                          <select
                            className="border rounded px-2 py-2 text-sm"
                            value={(act as any).label_id ?? ""}
                            onChange={(e) =>
                              setAutoActions((prev) => {
                                const copy = [...prev] as any[];
                                copy[idx] = { ...copy[idx], label_id: e.target.value };
                                return copy as any;
                              })
                            }
                          >
                            {autoLabels.map((l) => (
                              <option key={l.id} value={l.id}>
                                {l.name}
                              </option>
                            ))}
                          </select>
                        )}
                        {"user_id" in act && (
                          <select
                            className="border rounded px-2 py-2 text-sm"
                            value={(act as any).user_id ?? ""}
                            onChange={(e) =>
                              setAutoActions((prev) => {
                                const copy = [...prev] as any[];
                                copy[idx] = { ...copy[idx], user_id: e.target.value };
                                return copy as any;
                              })
                            }
                          >
                            {autoMembers.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name ?? m.id}
                              </option>
                            ))}
                          </select>
                        )}
                        {"list_id" in act && (
                          <select
                            className="border rounded px-2 py-2 text-sm"
                            value={(act as any).list_id ?? ""}
                            onChange={(e) =>
                              setAutoActions((prev) => {
                                const copy = [...prev] as any[];
                                copy[idx] = { ...copy[idx], list_id: e.target.value };
                                return copy as any;
                              })
                            }
                          >
                            {autoLists.map((l) => (
                              <option key={l.id} value={l.id}>
                                {l.name}
                              </option>
                            ))}
                          </select>
                        )}
                        {"when" in act && (
                          <select
                            className="border rounded px-2 py-2 text-sm"
                            value={(act as any).when ?? "now"}
                            onChange={(e) =>
                              setAutoActions((prev) => {
                                const copy = [...prev] as any[];
                                copy[idx] = { ...copy[idx], when: e.target.value as any };
                                return copy as any;
                              })
                            }
                          >
                            <option value="now">Agora</option>
                          </select>
                        )}
                        {"days" in act && (
                          <input
                            type="number"
                            className="border rounded px-2 py-2 text-sm w-28"
                            value={(act as any).days ?? 1}
                            onChange={(e) =>
                              setAutoActions((prev) => {
                                const copy = [...prev] as any[];
                                copy[idx] = { ...copy[idx], days: Number(e.target.value) };
                                return copy as any;
                              })
                            }
                          />
                        )}
                        {"title" in act && (
                          <input
                            className="border rounded px-2 py-2 text-sm"
                            placeholder="Título do checklist"
                            value={(act as any).title ?? ""}
                            onChange={(e) =>
                              setAutoActions((prev) => {
                                const copy = [...prev] as any[];
                                copy[idx] = { ...copy[idx], title: e.target.value };
                                return copy as any;
                              })
                            }
                          />
                        )}
                        {"itemsText" in act && (
                          <input
                            className="border rounded px-2 py-2 text-sm flex-1"
                            placeholder="Itens (separados por vírgula)"
                            value={(act as any).itemsText ?? ""}
                            onChange={(e) =>
                              setAutoActions((prev) => {
                                const copy = [...prev] as any[];
                                copy[idx] = { ...copy[idx], itemsText: e.target.value };
                                return copy as any;
                              })
                            }
                          />
                        )}
                        {"text" in act && (
                          <input
                            className="border rounded px-2 py-2 text-sm flex-1"
                            placeholder="Comentário"
                            value={(act as any).text ?? ""}
                            onChange={(e) =>
                              setAutoActions((prev) => {
                                const copy = [...prev] as any[];
                                copy[idx] = { ...copy[idx], text: e.target.value };
                                return copy as any;
                              })
                            }
                          />
                        )}
                      </div>
                      <div className="flex justify-end">
                        <Button variant="ghost" size="sm" onClick={() => setAutoActions((prev) => prev.filter((_, i) => i !== idx))}>
                          Remover
                        </Button>
                      </div>
                    </div>
                  ))}
                  <div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        setAutoActions((prev) => [...prev, { type: "add_label", label_id: autoLabels[0]?.id } as any])
                      }
                    >
                      Adicionar ação
                    </Button>
                  </div>
                </div>
                <div className="md:col-span-2">
                  <Button
                    isLoading={autoLoading}
                    onClick={async () => {
                      if (!autoName || !autoToList || autoActions.length === 0) return;
                      setAutoLoading(true);
                      try {
                        const actions = autoActions.map((a: any) => {
                          if (a.type === "create_checklist" && a.itemsText != null) {
                            const items = String(a.itemsText || "")
                              .split(",")
                              .map((s) => s.trim())
                              .filter(Boolean);
                            const { itemsText, ...rest } = a;
                            return { ...rest, items };
                          }
                          return a;
                        });
                        const res = await fetch("/api/automations", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            board_id: boardId,
                            name: autoName,
                            trigger_type: "event",
                          trigger_config:
                            autoEvent === "card.moved"
                              ? { event: "card.moved", to_list_id: autoToList }
                              : autoEvent === "card.created"
                              ? autoToList === "*"
                                ? { event: "card.created" }
                                : { event: "card.created", in_list_id: autoToList }
                              : autoEvent === "label.added"
                              ? { event: "label.added", label_id: autoTriggerLabel || autoLabels[0]?.id }
                              : { event: autoEvent },
                            actions,
                          }),
                        });
                        const json = await res.json();
                        if (json?.data) {
                          setAutomations((prev) => [json.data, ...prev]);
                          setAutoName("");
                          setAutoActions([]);
                        }
                      } finally {
                        setAutoLoading(false);
                      }
                    }}
                  >
                    Criar
                  </Button>
                </div>
              </div>
              <div className="space-y-2 max-h-[50vh] overflow-auto">
                {automations.map((a) => (
                  <div key={a.id} className="border rounded px-3 py-2 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium truncate">
                        {a.name || summarizeTriggerDetailed(a.trigger_config)}
                      </div>
                      <div className="text-xs text-neutral-500">
                        Gatilho: {summarizeTriggerDetailed(a.trigger_config)}
                      </div>
                      <div className="text-xs text-neutral-500">
                        Ações: {(a.actions ?? []).map((ac: any) => summarizeActionDetailed(ac)).join(" → ")}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs inline-flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={!!a.enabled}
                          onChange={async (e) => {
                            const enabled = e.target.checked;
                            await fetch("/api/automations", {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ id: a.id, enabled }),
                            });
                            setAutomations((prev) => prev.map((x) => (x.id === a.id ? { ...x, enabled } : x)));
                          }}
                        />
                        Ativa
                      </label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          await fetch("/api/automations", {
                            method: "DELETE",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ id: a.id }),
                          });
                          setAutomations((prev) => prev.filter((x) => x.id !== a.id));
                        }}
                      >
                        Excluir
                      </Button>
                    </div>
                  </div>
                ))}
                {automations.length === 0 && !autoLoading && (
                  <p className="text-sm text-neutral-600">Nenhuma automação criada.</p>
                )}
              </div>
            </div>
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


