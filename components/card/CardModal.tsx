import { useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { getSupabaseBrowserClient } from "@/lib/supabase-client";
import { Button } from "@/components/ui/Button";
import {
  Calendar,
  CheckSquare,
  Link as LinkIcon,
  Tag,
  Users,
  X,
  MoveRight,
  Pencil,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import TextareaAutosize from "react-textarea-autosize";
import { RichEditor } from "@/components/ui/RichEditor";
import { Popover } from "@/components/ui/Popover";
import { Lightbox } from "@/components/ui/Lightbox";
import {
  getCachedSignedUrl,
  setCachedSignedUrl,
} from "@/lib/storage-url-cache";

const ENABLE_MENTIONS = false;

// cache simples para URLs assinadas (evita sumiço da capa ao abrir o modal)
const signedUrlCache: Map<string, { url: string; expiresAt: number }> =
  new Map();

type Label = { id: string; board_id: string; name: string; color: string };
type Checklist = { id: string; card_id: string; title: string };
type ChecklistItem = {
  id: string;
  checklist_id: string;
  title: string;
  done: boolean;
  position: number;
};
type Attachment = {
  id: string;
  card_id: string;
  filename: string;
  path: string;
  created_at: string;
};

export function CardModal({
  cardId,
  boardId,
  open,
  onClose,
}: {
  cardId: string;
  boardId: string;
  open: boolean;
  onClose: () => void;
}) {
  const supabase = useMemo(() => getSupabaseBrowserClient() as any, []);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState<string>("");
  const [startDate, setStartDate] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [recurrence, setRecurrence] = useState<
    "none" | "daily" | "weekly" | "monthly"
  >("none");
  const [reminderMinutes, setReminderMinutes] = useState<number | null>(null);
  const [descPreview, setDescPreview] = useState(false);

  const [labels, setLabels] = useState<Label[]>([]);
  const [cardLabelIds, setCardLabelIds] = useState<string[]>([]);
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [itemsByChecklist, setItemsByChecklist] = useState<
    Record<string, ChecklistItem[]>
  >({});
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState<
    { id: string; content: string; created_at: string; author_id?: string | null }[]
  >([]);
  const [commentAuthors, setCommentAuthors] = useState<Record<string, { display_name: string | null }>>({});
  const [activity, setActivity] = useState<
    { id: string; action: string; created_at: string; actor_id: string | null; payload: any }[]
  >([]);
  const [activityProfiles, setActivityProfiles] = useState<Record<string, { display_name: string | null }>>({});
  const mentionAnchorRef = useRef<HTMLDivElement | null>(null);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionResults, setMentionResults] = useState<
    { id: string; display_name: string | null }[]
  >([]);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [lists, setLists] = useState<{ id: string; name: string }[]>([]);
  const [moveListId, setMoveListId] = useState<string | null>(null);
  const [coverSize, setCoverSize] = useState<"small" | "large">("small");
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [datesOpen, setDatesOpen] = useState(false);
  const labelsBtnRef = useRef<HTMLButtonElement | null>(null);
  const datesBtnRef = useRef<HTMLButtonElement | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const datesPanelRef = useRef<HTMLDivElement | null>(null);
  const labelsPanelRef = useRef<HTMLDivElement | null>(null);
  const movePanelRef = useRef<HTMLDivElement | null>(null);
  const attachmentsPanelRef = useRef<HTMLDivElement | null>(null);
  const [following, setFollowing] = useState(false);
  const [membersPanelOpen, setMembersPanelOpen] = useState(false);
  const [workspaceMembers, setWorkspaceMembers] = useState<{ id: string; display_name: string | null }[]>([]);
  const [cardMemberIds, setCardMemberIds] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    let mounted = true;
    (async () => {
      setLoading(true);
      // Fase 1: conteúdo essencial
      const [cardRes, lblsRes, cLabelsRes, lsRes] = await Promise.all([
        supabase.from("cards").select("*").eq("id", cardId).single(),
        supabase.from("labels").select("*").eq("board_id", boardId),
        supabase.from("card_labels").select("*").eq("card_id", cardId),
        supabase
          .from("lists")
          .select("id,name")
          .eq("board_id", boardId)
          .order("position", { ascending: true }),
      ]);
      if (!mounted) return;
      const card = cardRes.data as any;
      setTitle(card?.title ?? "");
      setDescription(card?.description ?? "");
      setStartDate(card?.start_date ?? null);
      setDueDate(card?.due_date ?? null);
      setRecurrence((card?.recurrence as any) ?? "none");
      setReminderMinutes(card?.reminder_minutes ?? null);
      setLabels(lblsRes.data ?? []);
      setCardLabelIds(
        ((cLabelsRes.data ?? []) as any[]).map((r) => r.label_id)
      );
      setLists(lsRes.data ?? []);
      setMoveListId(card?.list_id ?? null);
      setCoverSize((card?.cover_size as any) ?? "small");
      if (card?.cover_path) {
        const cached = getCachedSignedUrl(card.cover_path);
        if (cached) {
          setCoverUrl(cached);
        } else {
          const { data: s } = await supabase.storage
            .from("attachments")
            .createSignedUrl(card.cover_path, 60 * 10);
          if (s?.signedUrl) {
            setCachedSignedUrl(card.cover_path, s.signedUrl, 600);
          }
          setCoverUrl(s?.signedUrl ?? null);
        }
      } else {
        setCoverUrl(null);
      }
      setLoading(false);
      // Fase 2 (assíncrona): pesado
      const [clsRes, attsRes, cmsRes, wsRes, cmRes] = await Promise.all([
        supabase.from("checklists").select("*").eq("card_id", cardId),
        supabase
          .from("attachments")
          .select("*")
          .eq("card_id", cardId)
          .order("created_at", { ascending: false }),
        supabase
          .from("card_comments")
          .select("id, content, created_at, author_id")
          .eq("card_id", cardId)
          .order("created_at", { ascending: false }),
        // membros do workspace do board
        supabase
          .from("boards")
          .select("workspace_id")
          .eq("id", boardId)
          .single(),
        supabase.from("card_members").select("user_id").eq("card_id", cardId),
      ]);
      const cls = clsRes.data ?? [];
      const itemsMap: Record<string, ChecklistItem[]> = {};
      if ((cls as any[]).length) {
        const ids = (cls as any[]).map((c) => c.id);
        const { data: itsAll } = await supabase
          .from("checklist_items")
          .select("*")
          .in("checklist_id", ids)
          .order("position", { ascending: true });
        const itsArr: any[] = (itsAll as any) ?? [];
        for (const it of itsArr) {
          itemsMap[it.checklist_id] = itemsMap[it.checklist_id] ?? [];
          itemsMap[it.checklist_id].push(it as any);
        }
      }
      setChecklists(cls as any);
      setItemsByChecklist(itemsMap);
      setAttachments(attsRes.data ?? []);
      setComments(cmsRes.data ?? []);
      setCardMemberIds(((cmRes.data ?? []) as any[]).map((x) => x.user_id));
      // workspace members
      try {
        const wsId = (wsRes.data as any)?.workspace_id as string | undefined;
        if (wsId) {
          const { data: wm } = await supabase
            .from("workspace_members")
            .select("user_id")
            .eq("workspace_id", wsId);
          const ids = Array.from(new Set((wm ?? []).map((x: any) => x.user_id)));
          if (ids.length) {
            const { data: profs } = await supabase
              .from("user_profiles")
              .select("id, display_name")
              .in("id", ids);
            setWorkspaceMembers(
              (profs ?? []).map((p: any) => ({
                id: p.id,
                display_name: p.display_name ?? null,
              }))
            );
          } else {
            setWorkspaceMembers([]);
          }
        }
      } catch {}
      // autores de comentários
      try {
        const ids = Array.from(new Set(((cmsRes.data ?? []) as any[]).map((c) => c.author_id).filter(Boolean)));
        if (ids.length) {
          const { data: profs } = await supabase.from("user_profiles").select("id, display_name").in("id", ids as string[]);
          setCommentAuthors(Object.fromEntries((profs ?? []).map((p: any) => [p.id, { display_name: p.display_name ?? null }])));
        } else {
          setCommentAuthors({});
        }
      } catch {}
      // atividade do cartão
      try {
        const { data: hist } = await supabase
          .from("card_history")
          .select("id, action, created_at, actor_id, payload")
          .eq("card_id", cardId)
          .order("created_at", { ascending: false });
        const rows: any[] = (hist as any) ?? [];
        setActivity(rows as any);
        const actorIds = Array.from(new Set(rows.map((r) => r.actor_id).filter(Boolean)));
        if (actorIds.length) {
          const { data: profs } = await supabase
            .from("user_profiles")
            .select("id, display_name")
            .in("id", actorIds as string[]);
          const map = Object.fromEntries((profs ?? []).map((p: any) => [p.id, { display_name: p.display_name ?? null }]));
          setActivityProfiles(map);
        } else {
          setActivityProfiles({});
        }
      } catch {}
    })();
    return () => {
      mounted = false;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, cardId, boardId, supabase]);

  // Realtime de comentários para refletir automações imediatamente
  useEffect(() => {
    if (!open || !cardId) return;
    const channel = supabase
      .channel(`cmts:${cardId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "card_comments",
          filter: `card_id=eq.${cardId}`,
        },
        (payload: any) => {
          const row = payload.new as {
            id: string;
            content: string;
            created_at: string;
            author_id?: string | null;
          };
          setComments((prev) => [row, ...prev]);
          if (row.author_id) {
            supabase
              .from("user_profiles")
              .select("id, display_name")
              .eq("id", row.author_id)
              .maybeSingle()
              .then((r: any) => {
                if (r?.data?.id) {
                  setCommentAuthors((prev) => ({ ...prev, [r.data.id]: { display_name: r.data.display_name ?? null } }));
                }
              })
              .catch(() => {});
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, cardId, supabase]);

  // Realtime de etiquetas (card_labels) para marcar/desmarcar em tempo real no popup
  useEffect(() => {
    if (!open || !cardId) return;
    const ch = supabase
      .channel(`labels:${cardId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "card_labels",
          filter: `card_id=eq.${cardId}`,
        },
        (payload: any) => {
          const insertedId = payload?.new?.label_id as string | undefined;
          const deletedId = payload?.old?.label_id as string | undefined;
          setCardLabelIds((prev) => {
            if (payload.eventType === "INSERT" && insertedId) {
              return prev.includes(insertedId) ? prev : [...prev, insertedId];
            }
            if (payload.eventType === "DELETE" && deletedId) {
              return prev.filter((id) => id !== deletedId);
            }
            return prev;
          });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [open, cardId, supabase]);

  async function toggleLabel(labelId: string) {
    const op = cardLabelIds.includes(labelId) ? "remove" : "add";
    const { authFetch } = await import("@/lib/auth-fetch");
    await authFetch("/api/card-labels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ card_id: cardId, label_id: labelId, op }),
    });
    setCardLabelIds((prev) =>
      op === "add" ? [...prev, labelId] : prev.filter((id) => id !== labelId)
    );
  }

  async function createLabel() {
    const name = prompt("Nome da etiqueta:")?.trim();
    if (!name) return;
    const color = prompt("Cor (hex):", "#60a5fa")?.trim() || "#60a5fa";
    const { data } = await supabase
      .from("labels")
      .insert({ name, color, board_id: boardId } as any)
      .select("*")
      .single();
    if (data) setLabels((prev) => [...prev, data as any]);
  }

  async function saveDescription() {
    await supabase.from("cards").update({ description } as any).eq("id", cardId);
  }

  async function saveDueDate(value: string) {
    const iso = value ? new Date(value).toISOString() : null;
    const { authFetch } = await import("@/lib/auth-fetch");
    await authFetch("/api/cards/dates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ card_id: cardId, due_date: iso }),
    });
    setDueDate(iso);
  }
  async function saveStartDate(value: string) {
    const iso = value ? new Date(value).toISOString() : null;
    const { authFetch } = await import("@/lib/auth-fetch");
    await authFetch("/api/cards/dates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ card_id: cardId, start_date: iso }),
    });
    setStartDate(iso);
  }

  async function addChecklist() {
    const title = prompt("Título do checklist:")?.trim();
    if (!title) return;
    const { data } = await supabase
      .from("checklists")
      .insert({ title, card_id: cardId } as any)
      .select("*")
      .single();
    if (data) {
      setChecklists((prev) => [...prev, data as any]);
      setItemsByChecklist((prev) => ({ ...prev, [data.id]: [] }));
    }
  }

  async function addChecklistItem(checklistId: string) {
    const title = prompt("Item:")?.trim();
    if (!title) return;
    const items = itemsByChecklist[checklistId] ?? [];
    const position = items.length
      ? Math.max(...items.map((i) => i.position)) + 100
      : 100;
    const { data } = await supabase
      .from("checklist_items")
      .insert({ title, checklist_id: checklistId, position } as any)
      .select("*")
      .single();
    if (data)
      setItemsByChecklist((prev) => ({
        ...prev,
        [checklistId]: [...items, data as any],
      }));
  }

  async function toggleChecklistItem(item: ChecklistItem) {
    const { authFetch } = await import("@/lib/auth-fetch");
    const res = await authFetch("/api/checklist-items/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_id: item.id }),
    });
    const json = await res.json();
    const updated = !!json.done;
    setItemsByChecklist((prev) => ({
      ...prev,
      [item.checklist_id]: (prev[item.checklist_id] ?? []).map((it) =>
        it.id === item.id ? { ...it, done: updated } : it
      ),
    }));
  }

  async function addAttachment(file: File) {
    const path = `${cardId}/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage
      .from("attachments")
      .upload(path, file);
    if (!error) {
      const { data } = await supabase
        .from("attachments")
        .insert({ card_id: cardId, filename: file.name, path } as any)
        .select("*")
        .single();
      if (data) {
        setAttachments((prev) => [data as any, ...prev]);
        try {
          await fetch("/api/automations/emit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "attachment.added", card_id: cardId }),
          });
        } catch {}
      }
    }
  }
  async function setCover(path: string) {
    await supabase.from("cards").update({ cover_path: path } as any).eq("id", cardId);
    const { data } = await supabase.storage
      .from("attachments")
      .createSignedUrl(path, 60 * 10);
    setCoverUrl(data?.signedUrl ?? null);
    try {
      await fetch("/api/automations/emit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "cover.changed", card_id: cardId }),
      });
    } catch {}
  }
  async function clearCover() {
    await supabase.from("cards").update({ cover_path: null } as any).eq("id", cardId);
    setCoverUrl(null);
    try {
      await fetch("/api/automations/emit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "cover.changed", card_id: cardId }),
      });
    } catch {}
  }

  async function moveCard() {
    if (!moveListId) return;
    const { data: existing } = await supabase
      .from("cards")
      .select("position")
      .eq("list_id", moveListId)
      .order("position", { ascending: false })
      .limit(1);
    const newPos =
      existing && existing.length ? (existing[0] as any).position + 100 : 100;
    await supabase
      .from("cards")
      .update({ list_id: moveListId, position: newPos } as any)
      .eq("id", cardId);
    onClose();
  }

  async function copyCard() {
    const { data: card } = await supabase
      .from("cards")
      .select("*")
      .eq("id", cardId)
      .single();
    if (!card) return;
    const { data: last } = await supabase
      .from("cards")
      .select("position")
      .eq("list_id", card.list_id)
      .order("position", { ascending: false })
      .limit(1);
    const pos = last && last.length ? (last[0] as any).position + 100 : 100;
    await supabase.from("cards").insert({
      board_id: card.board_id,
      list_id: card.list_id,
      title: `${card.title} (cópia)`,
      description: card.description,
      position: pos,
      start_date: card.start_date,
      due_date: card.due_date,
      cover_path: card.cover_path,
      cover_size: card.cover_size,
    } as any);
    onClose();
  }

  async function archiveCard() {
    if (!confirm("Arquivar este cartão?")) return;
    const now = new Date().toISOString();
    await supabase.from("cards").update({ archived_at: now } as any).eq("id", cardId);
    onClose();
    try {
      await fetch("/api/automations/emit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "card.archived", card_id: cardId }),
      });
    } catch {}
  }

  async function addComment() {
    const content = comment.trim();
    if (!content) return;
    const { data } = await supabase
      .from("card_comments")
      .insert({
        card_id: cardId,
        content,
        author_id: (await supabase.auth.getUser()).data.user?.id,
      })
      .select("*")
      .single();
    if (data) setComments((prev) => [data as any, ...prev]);
    setComment("");
    try {
      await fetch("/api/automations/emit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "comment.posted", card_id: cardId }),
      });
    } catch {}
  }

  function updateMentionState(next: string, caret: number) {
    if (!ENABLE_MENTIONS) return;
    const upto = next.slice(0, caret);
    const at = upto.lastIndexOf("@");
    if (at === -1) {
      setMentionOpen(false);
      setMentionQuery("");
      setMentionResults([]);
      setMentionIndex(0);
      return;
    }
    const after = upto.slice(at + 1);
    // encerra se espaço/linha/sem consulta
    if (/\s/.test(after) || after.length < 2) {
      setMentionOpen(false);
      setMentionQuery("");
      setMentionResults([]);
      setMentionIndex(0);
      return;
    }
    setMentionQuery(after);
    // buscar perfis
    const q = encodeURIComponent(after);
    fetch(`/api/user_profiles/search?q=${q}`)
      .then((r) => r.json())
      .then((json) => {
        const arr =
          (json?.data as any[])?.map((u) => ({
            id: u.id,
            display_name: u.display_name ?? null,
          })) ?? [];
        setMentionResults(arr);
        setMentionIndex(0);
        setMentionOpen(arr.length > 0);
      })
      .catch(() => {
        setMentionResults([]);
        setMentionIndex(0);
        setMentionOpen(false);
      });
  }

  function insertMention(choice: { id: string; display_name: string | null }) {
    const ta = textareaRef.current;
    const name = choice.display_name ?? choice.id;
    if (!ta) return;
    const caret = ta.selectionStart ?? comment.length;
    const upto = comment.slice(0, caret);
    const at = upto.lastIndexOf("@");
    if (at === -1) return;
    const before = comment.slice(0, at);
    const afterAll = comment.slice(caret);
    const inserted = `@${name} `;
    const next = `${before}${inserted}${afterAll}`;
    setComment(next);
    setMentionOpen(false);
    setMentionQuery("");
    setMentionResults([]);
    setMentionIndex(0);
    // posiciona o caret após a menção
    requestAnimationFrame(() => {
      try {
        const pos = before.length + inserted.length;
        ta.setSelectionRange(pos, pos);
        ta.focus();
      } catch {}
    });
  }

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  function fmtInputDate(value: string | null) {
    if (!value) return "";
    const d = new Date(value);
    const off = d.getTimezoneOffset();
    const local = new Date(d.getTime() - off * 60000);
    return local.toISOString().slice(0, 16);
  }

  return (
    <Modal open={open} onClose={onClose}>
      {loading ? (
        <div className="p-6">Carregando...</div>
      ) : (
        <>
          <div>
            {/* capa e header */}
            <div className="relative">
              {coverUrl ? (
                <div
                  className={`w-full ${
                    coverSize === "large" ? "h-56 md:h-64" : "h-28 md:h-32"
                  } rounded-t-xl overflow-hidden cursor-zoom-in`}
                  onClick={() => setLightboxSrc(coverUrl)}
                >
                  <img
                    src={coverUrl}
                    alt="capa"
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-full h-24 md:h-28 rounded-t-xl bg-neutral-100" />
              )}
              <button
                className="absolute top-3 right-3 bg-white/80 hover:bg-white border rounded-md px-2 py-1 text-sm"
                onClick={onClose}
              >
                <X size={14} />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_360px] gap-6 p-6">
              <div className="space-y-6">
                <div>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onBlur={async () => {
                      await supabase
                        .from("cards")
                        .update({ title } as any)
                        .eq("id", cardId);
                    }}
                    className="w-full text-xl font-semibold bg-transparent outline-none"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Descrição</label>
                  </div>
                  <RichEditor
                    value={description ?? ""}
                    onChange={setDescription}
                  />
                  <SaveRow onSave={saveDescription} />
                </div>

                <div className="space-y-3">
                  {checklists.map((cl) => {
                    const items = itemsByChecklist[cl.id] ?? [];
                    const total = items.length;
                    const done = items.filter((i) => i.done).length;
                    const pct = total ? Math.round((done / total) * 100) : 0;
                    return (
                      <div key={cl.id} className="border rounded-md p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <CheckSquare size={16} />
                            <h4 className="font-medium">{cl.title}</h4>
                            <span className="text-xs text-neutral-600">
                              {pct}%
                            </span>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => addChecklistItem(cl.id)}
                          >
                            Adicionar item
                          </Button>
                        </div>
                        <div className="space-y-2">
                          {items.map((it) => (
                            <label
                              key={it.id}
                              className="flex items-center gap-2 text-sm"
                            >
                              <input
                                type="checkbox"
                                checked={it.done}
                                onChange={() => toggleChecklistItem(it)}
                              />
                              <span
                                className={
                                  it.done ? "line-through text-neutral-500" : ""
                                }
                              >
                                {it.title}
                              </span>
                            </label>
                          ))}
                          {items.length === 0 && (
                            <p className="text-sm text-neutral-500">
                              Sem itens.
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="space-y-2" ref={attachmentsPanelRef}>
                  <label className="text-sm font-medium">Anexos</label>
                  <div className="space-y-2">
                    <input
                      type="file"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (f) await addAttachment(f);
                      }}
                    />
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {attachments.map((a) => (
                        <AttachmentThumb
                          key={a.id}
                          path={a.path}
                          filename={a.filename}
                          onOpen={async () => {
                            const { data } = await supabase.storage
                              .from("attachments")
                              .createSignedUrl(a.path, 60);
                            if (data?.signedUrl) setLightboxSrc(data.signedUrl);
                          }}
                          onSetCover={() => setCover(a.path)}
                        />
                      ))}
                    </div>
                    {attachments.length === 0 && (
                      <p className="text-sm text-neutral-500">Nenhum anexo.</p>
                    )}
                    {coverUrl && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-neutral-600">
                          Tamanho da capa:
                        </span>
                        <div className="inline-flex rounded-md border overflow-hidden">
                          <button
                            className={`px-3 py-1 text-sm ${
                              coverSize === "small"
                                ? "bg-neutral-200"
                                : "bg-white hover:bg-neutral-50"
                            }`}
                            onClick={async () => {
                              setCoverSize("small");
                              await supabase
                                .from("cards")
                                .update({ cover_size: "small" } as any)
                                .eq("id", cardId);
                            }}
                          >
                            Pequena
                          </button>
                          <button
                            className={`px-3 py-1 text-sm border-l ${
                              coverSize === "large"
                                ? "bg-neutral-200"
                                : "bg-white hover:bg-neutral-50"
                            }`}
                            onClick={async () => {
                              setCoverSize("large");
                              await supabase
                                .from("cards")
                                .update({ cover_size: "large" } as any)
                                .eq("id", cardId);
                            }}
                          >
                            Grande
                          </button>
                        </div>
                        <button
                          className="text-sm underline"
                          onClick={clearCover}
                        >
                          Remover capa
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Comentários</label>
                  <div className="flex gap-2" ref={mentionAnchorRef}>
                    <TextareaAutosize
                      ref={textareaRef as any}
                      className="flex-1 border rounded px-3 py-2"
                      placeholder="Escreva um comentário (Markdown habilitado)..."
                      value={comment}
                      onChange={(e) => {
                        setComment(e.target.value);
                        if (ENABLE_MENTIONS) {
                          const caret =
                            (e.target as HTMLTextAreaElement).selectionStart ??
                            e.target.value.length;
                          updateMentionState(e.target.value, caret);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (!ENABLE_MENTIONS || !mentionOpen) return;
                        if (e.key === "ArrowDown") {
                          e.preventDefault();
                          setMentionIndex((i) =>
                            Math.min(i + 1, Math.max(mentionResults.length - 1, 0))
                          );
                        } else if (e.key === "ArrowUp") {
                          e.preventDefault();
                          setMentionIndex((i) => Math.max(i - 1, 0));
                        } else if (e.key === "Enter") {
                          e.preventDefault();
                          const choice = mentionResults[mentionIndex];
                          if (choice) insertMention(choice);
                        } else if (e.key === "Escape") {
                          setMentionOpen(false);
                        }
                      }}
                    />
                    <SendCommentButton onSend={addComment} />
                  </div>
                  {ENABLE_MENTIONS && (
                    <Popover
                      open={mentionOpen}
                      onClose={() => setMentionOpen(false)}
                      anchorRect={mentionAnchorRef.current?.getBoundingClientRect()}
                      width={320}
                    >
                      <div className="p-2">
                        <div className="text-xs text-neutral-600 mb-1">
                          Mencionar: @{mentionQuery}
                        </div>
                        {mentionResults.length === 0 ? (
                          <div className="text-sm text-neutral-500 px-1 py-1">
                            Nenhum resultado
                          </div>
                        ) : (
                          <div className="max-h-64 overflow-auto">
                            {mentionResults.map((u, i) => (
                              <button
                                key={u.id}
                                className={`w-full text-left px-2 py-1 rounded text-sm ${
                                  i === mentionIndex ? "bg-neutral-100" : "hover:bg-neutral-50"
                                }`}
                                onClick={() => insertMention(u)}
                              >
                                {u.display_name ?? u.id}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </Popover>
                  )}
                  <div className="space-y-2">
                    {comments.map((c) => (
                      <div key={c.id} className="text-sm border rounded p-2">
                        <div className="text-neutral-500 text-xs">
                          {commentAuthors[c.author_id ?? ""]?.display_name
                            ? `${commentAuthors[c.author_id ?? ""]?.display_name} — ${new Date(c.created_at).toLocaleString()}`
                            : new Date(c.created_at).toLocaleString()}
                        </div>
                        <div className="prose prose-sm max-w-none">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {c.content}
                          </ReactMarkdown>
                        </div>
                      </div>
                    ))}
                    {comments.length === 0 && (
                      <p className="text-sm text-neutral-500">
                        Sem comentários.
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Atividade</label>
                    {activity.length === 0 ? (
                      <p className="text-sm text-neutral-500">Sem atividades.</p>
                    ) : (
                      <div className="space-y-1">
                        {activity.map((a) => (
                          <div key={a.id} className="text-xs border rounded px-2 py-1 flex items-center justify-between">
                            <div className="min-w-0">
                              <span className="font-medium">
                                {activityProfiles[a.actor_id ?? ""]?.display_name ?? "Alguém"}
                              </span>{" "}
                              <span className="text-neutral-700">{summarizeActivity(a)}</span>
                            </div>
                            <span className="text-neutral-500 shrink-0">
                              {new Date(a.created_at).toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {/* Ações (estilo Trello) */}
                <div className="border rounded-md p-3">
                  <div className="text-sm font-medium mb-2">Ações</div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      leftIcon={<Users size={14} />}
                      onClick={() => setMembersPanelOpen((v) => !v)}
                    >
                      Membros
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      leftIcon={<Tag size={14} />}
                      onClick={() => {
                        labelsPanelRef.current?.scrollIntoView({
                          behavior: "smooth",
                          block: "start",
                        });
                      }}
                    >
                      Etiquetas
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      leftIcon={<CheckSquare size={14} />}
                      onClick={addChecklist}
                    >
                      Checklist
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      leftIcon={<Calendar size={14} />}
                      onClick={() => {
                        datesPanelRef.current?.scrollIntoView({
                          behavior: "smooth",
                          block: "start",
                        });
                      }}
                    >
                      Datas
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      leftIcon={<LinkIcon size={14} />}
                      onClick={() => {
                        attachmentsPanelRef.current?.scrollIntoView({
                          behavior: "smooth",
                          block: "start",
                        });
                      }}
                    >
                      Anexo
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      leftIcon={<MoveRight size={14} />}
                      onClick={() => {
                        movePanelRef.current?.scrollIntoView({
                          behavior: "smooth",
                          block: "start",
                        });
                      }}
                    >
                      Mover
                    </Button>
                    <Button variant="secondary" size="sm" onClick={copyCard}>
                      Copiar
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={async () => {
                        const url = location.href;
                        try {
                          await navigator.clipboard.writeText(url);
                          alert("Link copiado!");
                        } catch {}
                      }}
                    >
                      Compartilhar
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setFollowing((v) => !v)}
                    >
                      {following ? "Seguindo" : "Seguir"}
                    </Button>
                    <Button variant="secondary" size="sm" onClick={archiveCard}>
                      Arquivar
                    </Button>
                  </div>
                </div>
                {membersPanelOpen && (
                  <div className="border rounded-md p-3">
                    <div className="text-sm font-medium mb-2">Membros do cartão</div>
                    <div className="flex items-center gap-2 mb-2">
                      <Button
                        size="sm"
                        onClick={async () => {
                          const me = (await supabase.auth.getUser()).data.user?.id;
                          if (!me) return;
                          if (cardMemberIds.includes(me)) return;
                          const { authFetch } = await import("@/lib/auth-fetch");
                          await authFetch("/api/card-members", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ card_id: cardId, user_id: me }),
                          });
                          setCardMemberIds((prev) => [...prev, me]);
                        }}
                      >
                        Atribuir-me
                      </Button>
                    </div>
                    <div className="max-h-64 overflow-auto space-y-1">
                      {workspaceMembers.length === 0 ? (
                        <div className="text-sm text-neutral-500">Nenhum membro no workspace.</div>
                      ) : (
                        workspaceMembers.map((m) => {
                          const checked = cardMemberIds.includes(m.id);
                          return (
                            <label key={m.id} className="flex items-center justify-between px-2 py-1 rounded hover:bg-neutral-50 text-sm">
                              <span className="truncate">{m.display_name ?? m.id}</span>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={async (e) => {
                                  if (e.target.checked) {
                                    const { authFetch } = await import("@/lib/auth-fetch");
                                    await authFetch("/api/card-members", {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ card_id: cardId, user_id: m.id }),
                                    });
                                    setCardMemberIds((prev) => (prev.includes(m.id) ? prev : [...prev, m.id]));
                                  } else {
                                    const { authFetch } = await import("@/lib/auth-fetch");
                                    await authFetch("/api/card-members", {
                                      method: "DELETE",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ card_id: cardId, user_id: m.id }),
                                    });
                                    setCardMemberIds((prev) => prev.filter((x) => x !== m.id));
                                  }
                                }}
                              />
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                <div
                  id="dates-panel"
                  ref={datesPanelRef}
                  className="border rounded-md p-3"
                >
                  <div className="text-sm font-medium mb-2">Datas</div>
                  <DatesInline
                    startValue={startDate}
                    dueValue={dueDate}
                    recurrence={recurrence}
                    reminder={reminderMinutes}
                    onSave={async (v) => {
                      const toIso = (s: string | "") =>
                        s ? new Date(s).toISOString() : null;
                      const startIso = toIso(v.start);
                      const dueIso = toIso(v.due);
                      // Atualiza datas via API para disparar automações no servidor
                      const res = await fetch("/api/cards/dates", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          card_id: cardId,
                          start_date: startIso,
                          due_date: dueIso,
                        }),
                      });
                      try {
                        const json = await res.json();
                        if (json?.triggered > 0) {
                          window.dispatchEvent(
                            new CustomEvent("card:refresh-meta", {
                              detail: { cardId },
                            })
                          );
                          // Recarrega lista de comentários como redundância ao realtime
                          const { data: cms } = await supabase
                            .from("card_comments")
                            .select("id, content, created_at")
                            .eq("card_id", cardId)
                            .order("created_at", { ascending: false });
                          setComments(cms ?? []);
                        }
                      } catch {}
                      // Atualiza demais campos diretamente
                      await supabase
                        .from("cards")
                        .update({
                          recurrence: v.recurrence,
                          reminder_minutes:
                            v.reminder === "" ? null : v.reminder,
                        } as any)
                        .eq("id", cardId);
                      setStartDate(startIso);
                      setDueDate(dueIso);
                      setRecurrence(v.recurrence);
                      setReminderMinutes(
                        v.reminder === "" ? null : (v.reminder as number)
                      );
                    }}
                  />
                </div>

                <div ref={movePanelRef} className="border rounded-md p-3">
                  <div className="text-sm font-medium mb-2">Mover cartão</div>
                  <div className="flex items-center gap-2">
                    <select
                      className="border rounded px-2 py-1 flex-1"
                      value={moveListId ?? ""}
                      onChange={(e) => setMoveListId(e.target.value)}
                    >
                      {lists.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                    <Button
                      size="sm"
                      leftIcon={<MoveRight size={14} />}
                      onClick={moveCard}
                    >
                      Mover
                    </Button>
                  </div>
                </div>
                <div
                  id="labels-panel"
                  ref={labelsPanelRef}
                  className="border rounded-md p-3"
                >
                  <div className="text-sm font-medium mb-2">Etiquetas</div>
                  <LabelsEditor
                    labels={labels}
                    activeIds={cardLabelIds}
                    onToggle={toggleLabel}
                    onCreate={async (name, color) => {
                      const { data } = await supabase
                        .from("labels")
                        .insert({ name, color, board_id: boardId } as any)
                        .select("*")
                        .single();
                      if (data) setLabels((prev) => [...prev, data as any]);
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
          <Lightbox
            open={!!lightboxSrc}
            src={lightboxSrc ?? undefined}
            onClose={() => setLightboxSrc(null)}
          />
        </>
      )}
    </Modal>
  );
}

function wrapSelection(
  setter: (v: string) => void,
  value: string,
  prefix: string,
  suffix?: string
) {
  const sfx = suffix ?? prefix;
  const next = `${prefix}${value}${sfx}`;
  setter(next);
}

function summarizeActivity(a: { action: string; payload: any }) {
  const act = a.action || "";
  const p = a.payload || {};
  if (act === "created") return "criou o cartão";
  if (act === "updated") return "atualizou o cartão";
  if (act === "moved") return "moveu o cartão de lista";
  if (act === "dates_updated") return "atualizou as datas";
  if (act === "label.added") return "adicionou uma etiqueta";
  if (act === "label.removed") return "removeu uma etiqueta";
  if (act === "checklist.completed") return "concluiu um checklist";
  if (act === "checklist.item_toggled") return "marcou/desmarcou um item";
  if (act === "cover.changed") return "alterou a capa";
  if (act === "attachment.added") return "adicionou um anexo";
  if (act === "card.archived") return "arquivou o cartão";
  if (act === "card.restored") return "restaurou o cartão";
  if (act === "card.deleted") return "excluiu o cartão";
  return act;
}

function LabelsEditor({
  labels,
  activeIds,
  onToggle,
  onCreate,
}: {
  labels: Label[];
  activeIds: string[];
  onToggle: (id: string) => void;
  onCreate: (name: string, color: string) => Promise<void> | void;
}) {
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#60a5fa");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("#60a5fa");
  const colors = [
    "#f97316",
    "#ef4444",
    "#f59e0b",
    "#22c55e",
    "#10b981",
    "#06b6d4",
    "#3b82f6",
    "#8b5cf6",
    "#ec4899",
    "#14b8a6",
    "#a3a3a3",
    "#64748b",
  ];
  if (creating) {
    return (
      <div className="space-y-3">
        <div className="h-8 rounded-md" style={{ backgroundColor: newColor }} />
        <input
          className="w-full border rounded px-3 py-2"
          placeholder="Título"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <div className="grid grid-cols-6 gap-2">
          {colors.map((c) => (
            <button
              key={c}
              className={`h-8 rounded border ${
                newColor === c ? "ring-2 ring-neutral-600" : ""
              }`}
              style={{ backgroundColor: c }}
              onClick={() => setNewColor(c)}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={async () => {
              if (!newName.trim()) return;
              await onCreate(newName.trim(), newColor);
              setCreating(false);
              setNewName("");
            }}
          >
            Criar
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>
            Cancelar
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <input
        className="w-full border rounded px-3 py-2"
        placeholder="Buscar etiquetas..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="space-y-2">
        {labels
          .filter((l) => l.name.toLowerCase().includes(query.toLowerCase()))
          .map((l) => {
            const active = activeIds.includes(l.id);
            if (editingId === l.id) {
              return (
                <div key={l.id} className="space-y-2 border rounded p-2">
                  <div
                    className="h-8 rounded"
                    style={{ backgroundColor: editColor }}
                  />
                  <input
                    className="w-full border rounded px-2 py-1 text-sm"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                  <div className="grid grid-cols-6 gap-2">
                    {colors.map((c) => (
                      <button
                        key={c}
                        className={`h-6 rounded border ${
                          editColor === c ? "ring-2 ring-neutral-600" : ""
                        }`}
                        style={{ backgroundColor: c }}
                        onClick={() => setEditColor(c)}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={async () => {
                        await fetch("/api/labels/update", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            id: l.id,
                            name: editName,
                            color: editColor,
                          }),
                        });
                        l.name = editName;
                        (l as any).color = editColor;
                        setEditingId(null);
                      }}
                    >
                      Salvar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingId(null)}
                    >
                      Cancelar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        await fetch("/api/labels/delete", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ id: l.id }),
                        });
                        // remove localmente
                        const idx = activeIds.indexOf(l.id);
                        if (idx >= 0) activeIds.splice(idx, 1);
                        (labels as any[]).splice(
                          (labels as any[]).indexOf(l),
                          1
                        );
                        setEditingId(null);
                      }}
                    >
                      Excluir
                    </Button>
                  </div>
                </div>
              );
            }
            return (
              <div key={l.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={() => onToggle(l.id)}
                />
                <div
                  className="flex-1 h-8 rounded px-2 flex items-center justify-between text-white"
                  style={{ backgroundColor: l.color }}
                >
                  <span className="text-xs font-medium">{l.name}</span>
                  <button
                    onClick={() => {
                      setEditingId(l.id);
                      setEditName(l.name);
                      setEditColor(l.color);
                    }}
                    title="Editar etiqueta"
                  >
                    <Pencil size={14} className="opacity-80" />
                  </button>
                </div>
              </div>
            );
          })}
      </div>
      <Button variant="secondary" onClick={() => setCreating(true)}>
        Criar uma nova etiqueta
      </Button>
    </div>
  );
}

function DatesInline({
  startValue,
  dueValue,
  recurrence,
  reminder,
  onSave,
}: {
  startValue: string | null;
  dueValue: string | null;
  recurrence: "none" | "daily" | "weekly" | "monthly" | null;
  reminder: number | null;
  onSave: (v: {
    start: string | "";
    due: string | "";
    recurrence: "none" | "daily" | "weekly" | "monthly";
    reminder: number | "";
  }) => Promise<void> | void;
}) {
  function toLocalInput(iso: string) {
    const d = new Date(iso);
    const off = d.getTimezoneOffset();
    const local = new Date(d.getTime() - off * 60000);
    return local.toISOString().slice(0, 16);
  }
  function nowLocalInput() {
    const d = new Date();
    const off = d.getTimezoneOffset();
    const local = new Date(d.getTime() - off * 60000);
    return local.toISOString().slice(0, 16);
  }
  const [startEnabled, setStartEnabled] = useState(!!startValue);
  const [dueEnabled, setDueEnabled] = useState(!!dueValue);
  const [start, setStart] = useState<string>(
    startValue ? toLocalInput(startValue) : ""
  );
  const [due, setDue] = useState<string>(
    dueValue ? toLocalInput(dueValue) : ""
  );
  const [rec, setRec] = useState<"none" | "daily" | "weekly" | "monthly">(
    recurrence ?? "none"
  );
  const [rem, setRem] = useState<number | "">(reminder ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const startRef = useRef<HTMLInputElement | null>(null);
  const dueRef = useRef<HTMLInputElement | null>(null);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={startEnabled}
          onChange={(e) => {
            const checked = e.target.checked;
            setStartEnabled(checked);
            if (checked && !start) setStart(nowLocalInput());
            setTimeout(() => {
              (startRef.current as any)?.showPicker?.();
              startRef.current?.focus();
            }, 0);
          }}
        />
        <label className="text-sm w-28">Data de início</label>
        <input
          type="datetime-local"
          className="border rounded px-2 py-1 flex-1"
          disabled={!startEnabled}
          ref={startRef}
          value={start}
          onChange={(e) => setStart(e.target.value)}
        />
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={dueEnabled}
          onChange={(e) => {
            const checked = e.target.checked;
            setDueEnabled(checked);
            if (checked && !due) setDue(nowLocalInput());
            setTimeout(() => {
              (dueRef.current as any)?.showPicker?.();
              dueRef.current?.focus();
            }, 0);
          }}
        />
        <label className="text-sm w-28">Data de entrega</label>
        <input
          type="datetime-local"
          className="border rounded px-2 py-1 flex-1"
          disabled={!dueEnabled}
          ref={dueRef}
          value={due}
          onChange={(e) => setDue(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-neutral-600">Recorrente</label>
          <select
            className="w-full border rounded px-2 py-1"
            value={rec}
            onChange={(e) => setRec(e.target.value as any)}
          >
            <option value="none">Nunca</option>
            <option value="daily">Diária</option>
            <option value="weekly">Semanal</option>
            <option value="monthly">Mensal</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-neutral-600">Lembrete</label>
          <select
            className="w-full border rounded px-2 py-1"
            value={rem}
            onChange={(e) =>
              setRem(e.target.value ? Number(e.target.value) : "")
            }
          >
            <option value="">Nenhum</option>
            <option value="0">Na hora</option>
            <option value="5">5 minutos antes</option>
            <option value="10">10 minutos antes</option>
            <option value="15">15 minutos antes</option>
            <option value="30">30 minutos antes</option>
            <option value="60">1 hora antes</option>
          </select>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <Button
          size="sm"
          isLoading={saving}
          onClick={async () => {
            setSaving(true);
            await onSave({
              start: startEnabled ? start : "",
              due: dueEnabled ? due : "",
              recurrence: rec,
              reminder: rem,
            });
            setSaving(false);
            setSaved(true);
            setTimeout(() => setSaved(false), 1200);
          }}
        >
          {saved ? "Salvo" : "Salvar"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setStart("");
            setDue("");
            setStartEnabled(false);
            setDueEnabled(false);
            onSave({ start: "", due: "", recurrence: "none", reminder: "" });
          }}
        >
          Remover
        </Button>
      </div>
    </div>
  );
}

function SaveRow({ onSave }: { onSave: () => Promise<void> | void }) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  return (
    <div className="flex justify-end">
      <Button
        size="sm"
        isLoading={saving}
        onClick={async () => {
          setSaving(true);
          await onSave();
          setSaving(false);
          setSaved(true);
          setTimeout(() => setSaved(false), 1200);
        }}
      >
        {saved ? "Salvo" : "Salvar"}
      </Button>
    </div>
  );
}
function SendCommentButton({ onSend }: { onSend: () => Promise<void> | void }) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  return (
    <Button
      isLoading={sending}
      onClick={async () => {
        setSending(true);
        await onSend();
        setSending(false);
        setSent(true);
        setTimeout(() => setSent(false), 1000);
      }}
    >
      {sent ? "Enviado" : "Enviar"}
    </Button>
  );
}
function AttachmentThumb({
  path,
  filename,
  onOpen,
  onSetCover,
}: {
  path: string;
  filename: string;
  onOpen: () => void;
  onSetCover: () => void;
}) {
  const supabase = getSupabaseBrowserClient();
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.storage
        .from("attachments")
        .createSignedUrl(path, 60 * 10);
      if (mounted) setUrl(data?.signedUrl ?? null);
    })();
    return () => {
      mounted = false;
    };
  }, [path, supabase]);

  const isImage = /\.(png|jpg|jpeg|webp|gif)$/i.test(filename);
  return (
    <div className="border rounded overflow-hidden">
      <div className="w-full h-24 bg-neutral-100 flex items-center justify-center">
        {isImage && url ? (
          <img
            src={url}
            alt={filename}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="text-xs p-2 truncate">{filename}</div>
        )}
      </div>
      <div className="flex divide-x">
        <button
          className="flex-1 text-xs px-2 py-1 hover:bg-neutral-50"
          onClick={onOpen}
        >
          Abrir
        </button>
        <button
          className="flex-1 text-xs px-2 py-1 hover:bg-neutral-50"
          onClick={onSetCover}
        >
          Capa
        </button>
      </div>
    </div>
  );
}
