"use client";

import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  PointerSensor,
  rectIntersection,
  useSensor,
  useSensors,
  DragOverlay,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useEffect, useMemo, useState } from "react";
import { KanbanList } from "./KanbanList";
import { KanbanCard } from "./KanbanCard";
import { getSupabaseBrowserClient } from "@/lib/supabase-client";
import { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { Plus, Filter } from "lucide-react";
import { CardModal } from "@/components/card/CardModal";
import { AvatarStack } from "@/components/ui/Avatar";
import { setCachedSignedUrl } from "@/lib/storage-url-cache";
import { Popover } from "@/components/ui/Popover";
import { Button } from "@/components/ui/Button";
import * as React from "react";

export type Card = {
  id: string;
  board_id: string;
  list_id: string;
  title: string;
  description: string | null;
  position: number;
  start_date?: string | null;
  due_date: string | null;
  recurrence?: "none" | "daily" | "weekly" | "monthly" | null;
  reminder_minutes?: number | null;
  cover_path?: string | null;
  cover_size?: "small" | "large" | null;
  created_at: string;
  updated_at: string;
};

export type List = {
  id: string;
  board_id: string;
  name: string;
  position: number;
  created_at: string;
};

type BoardSettings = {
  auto_start_on_create: boolean;
  due_offset_minutes: number;
  due_soon_threshold_minutes: number;
};

export function KanbanBoard({
  boardId,
  workspaceId,
}: {
  boardId: string;
  workspaceId: string;
}) {
  const supabase = useMemo(() => getSupabaseBrowserClient() as any, []);
  const [lists, setLists] = useState<List[]>([]);
  const [cardsByList, setCardsByList] = useState<Record<string, Card[]>>({});
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 3 } })
  );
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [membersByCard, setMembersByCard] = useState<
    Record<
      string,
      { id?: string; name?: string | null; avatar_url?: string | null }[]
    >
  >({});
  const [labelsIndex, setLabelsIndex] = useState<
    Record<string, { id: string; name: string; color: string }>
  >({});
  const [attachmentsCountByCard, setAttachmentsCountByCard] = useState<
    Record<string, number>
  >({});
  const [commentsCountByCard, setCommentsCountByCard] = useState<
    Record<string, number>
  >({});
  const [settings, setSettings] = useState<BoardSettings>({
    auto_start_on_create: false,
    due_offset_minutes: 0,
    due_soon_threshold_minutes: 1440,
  });
  const [labelsByCard, setLabelsByCard] = useState<
    Record<string, { id: string; name: string; color: string }[]>
  >({});
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [overListId, setOverListId] = useState<string | null>(null);
  const [draggingListId, setDraggingListId] = useState<string | null>(null);
  const activeOverlay = useMemo(() => {
    if (!activeDragId) return null;
    const [lId, cId] = activeDragId.split(":");
    const arr = cardsByList[lId] ?? [];
    const base = arr.find((c) => c.id === cId);
    if (!base) return null;
    return {
      listId: lId,
      card: {
        ...base,
        members: membersByCard[base.id] ?? [],
        labels: labelsByCard[base.id] ?? [],
        attachmentsCount: attachmentsCountByCard[base.id] ?? 0,
        commentsCount: commentsCountByCard[base.id] ?? 0,
      },
    };
  }, [
    activeDragId,
    cardsByList,
    membersByCard,
    labelsByCard,
    attachmentsCountByCard,
    commentsCountByCard,
  ]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: ls } = await supabase
        .from("lists")
        .select("*")
        .eq("board_id", boardId)
        .order("position", { ascending: true });
      const { data: cs } = await supabase
        .from("cards")
        .select("*")
        .eq("board_id", boardId)
        .is("archived_at", null)
        .order("position", { ascending: true });
      if (!mounted) return;
      setLists(ls ?? []);
      const map: Record<string, Card[]> = {};
      for (const l of ls ?? []) {
        map[l.id] = (cs ?? []).filter((c: any) => c.list_id === l.id);
      }
      setCardsByList(map);
      // Prefetch das capas para evitar latência ao abrir modal
      const coverPaths = (cs ?? [])
        .map((c: any) => c.cover_path)
        .filter(Boolean) as string[];
      if (coverPaths.length) {
        try {
          await Promise.all(
            coverPaths.map(async (p) => {
              const { data: one } = await supabase.storage
                .from("attachments")
                .createSignedUrl(p, 60 * 10);
              if (one?.signedUrl) {
                setCachedSignedUrl(p, one.signedUrl, 600);
              }
            })
          );
        } catch {}
      }

      // fetch members for all cards
      const cardIds = (cs ?? []).map((c: any) => c.id);
      if (cardIds.length) {
        const { data: cm } = await supabase
          .from("card_members")
          .select("*")
          .in("card_id", cardIds);
        const userIds = Array.from(
          new Set((cm ?? []).map((m: any) => m.user_id))
        );
        const { data: profiles } = await supabase
          .from("user_profiles")
          .select("*")
          .in("id", userIds);
        const pMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
        const byCard: Record<
          string,
          { id?: string; name?: string | null; avatar_url?: string | null }[]
        > = {};
        for (const c of cm ?? []) {
          byCard[c.card_id] = byCard[c.card_id] ?? [];
          const prof = pMap.get(c.user_id) as any;
          byCard[c.card_id].push({
            id: c.user_id,
            name: prof?.display_name ?? null,
            avatar_url: prof?.avatar_url ?? null,
          });
        }
        setMembersByCard(byCard);
      }
      // Carrega membros do workspace para popular filtro mesmo sem atribuição
      try {
        const { data: wsms } = await supabase
          .from("workspace_members")
          .select("user_id")
          .eq("workspace_id", workspaceId);
        const wsUserIds = Array.from(new Set((wsms ?? []).map((x: any) => x.user_id)));
        if (wsUserIds.length) {
          const { data: wsProfiles } = await supabase
            .from("user_profiles")
            .select("id, display_name")
            .in("id", wsUserIds);
          const extras = (wsProfiles ?? []).map((p: any) => ({ id: p.id, name: p.display_name ?? null }));
          // mescla nos membersByCard virtuais para aparecer no filtro
          setMembersByCard((prev) => {
            const copy = { ...prev };
            copy["_workspace_members"] = extras as any;
            return copy;
          });
        }
      } catch {}
      // fetch labels for all cards
      const { data: allLabels } = await supabase
        .from("labels")
        .select("*")
        .eq("board_id", boardId);
      const { data: cardLabels } = await supabase
        .from("card_labels")
        .select("*")
        .in("card_id", cardIds);
      const labelMap = new Map((allLabels ?? []).map((l: any) => [l.id, l]));
      setLabelsIndex(
        Object.fromEntries(
          (allLabels ?? []).map((l: any) => [
            l.id,
            { id: l.id, name: l.name, color: l.color },
          ])
        )
      );
      const byCardLabels: Record<
        string,
        { id: string; name: string; color: string }[]
      > = {};
      for (const cl of cardLabels ?? []) {
        const lab = labelMap.get(cl.label_id) as any;
        if (!lab) continue;
        byCardLabels[cl.card_id] = byCardLabels[cl.card_id] ?? [];
        byCardLabels[cl.card_id].push({
          id: lab.id,
          name: lab.name,
          color: lab.color,
        });
      }
      setLabelsByCard(byCardLabels);

      // fetch attachments count per card
      const { data: atts } = await supabase
        .from("attachments")
        .select("card_id");
      const countMap: Record<string, number> = {};
      for (const a of atts ?? []) {
        countMap[a.card_id] = (countMap[a.card_id] ?? 0) + 1;
      }
      setAttachmentsCountByCard(countMap);

      // fetch comments count per card
      const { data: cms } = await supabase
        .from("card_comments")
        .select("card_id");
      const cCount: Record<string, number> = {};
      for (const c of cms ?? []) {
        cCount[c.card_id] = (cCount[c.card_id] ?? 0) + 1;
      }
      setCommentsCountByCard(cCount);

      // settings
      const { data: st } = await supabase
        .from("board_settings")
        .select("*")
        .eq("board_id", boardId)
        .maybeSingle();
      if (st)
        setSettings({
          auto_start_on_create: st.auto_start_on_create,
          due_offset_minutes: st.due_offset_minutes,
          due_soon_threshold_minutes: st.due_soon_threshold_minutes,
        });
    })();
    return () => {
      mounted = false;
    };
  }, [boardId, supabase]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel(`board:${boardId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "lists",
          filter: `board_id=eq.${boardId}`,
        },
        (payload: RealtimePostgresChangesPayload<List>) => {
          setLists((prev) => {
            if (payload.eventType === "INSERT")
              return [...prev, payload.new].sort(
                (a, b) => a.position - b.position
              );
            if (payload.eventType === "UPDATE")
              return prev
                .map((l) => (l.id === payload.new.id ? payload.new : l))
                .sort((a, b) => a.position - b.position);
            if (payload.eventType === "DELETE")
              return prev.filter((l) => l.id !== payload.old.id);
            return prev;
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "cards",
          filter: `board_id=eq.${boardId}`,
        },
        (payload: RealtimePostgresChangesPayload<Card>) => {
          setCardsByList((prev) => {
            const updated = { ...prev };
            if (payload.eventType === "INSERT") {
              if ((payload.new as any)?.archived_at) return updated;
              const listId = payload.new.list_id;
              updated[listId] = [...(updated[listId] ?? []), payload.new].sort(
                (a, b) => a.position - b.position
              );
            } else if (payload.eventType === "UPDATE") {
              // remove from old list if moved
              for (const key of Object.keys(updated)) {
                updated[key] = (updated[key] ?? []).filter(
                  (c) => c.id !== payload.new.id
                );
              }
              if ((payload.new as any)?.archived_at) {
                // arquivado: não reintroduzir
                return updated;
              }
              const listId = payload.new.list_id;
              updated[listId] = [...(updated[listId] ?? []), payload.new].sort(
                (a, b) => a.position - b.position
              );
            } else if (payload.eventType === "DELETE") {
              for (const key of Object.keys(updated)) {
                updated[key] = (updated[key] ?? []).filter(
                  (c) => c.id !== payload.old.id
                );
              }
            }
            return updated;
          });
        }
      )
      .subscribe();

    // card_labels realtime
    const channel2 = supabase
      .channel(`labels:${boardId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "card_labels" },
        (payload: any) => {
          const cardId = (payload.new?.card_id ??
            payload.old?.card_id) as string;
          // atualiza somente se o card existe neste board
          const exists = Object.values(cardsByList).some((arr) =>
            (arr ?? []).some((c) => c.id === cardId)
          );
          if (!exists) return;
          setLabelsByCard((prev) => {
            const copy = { ...prev };
            if (payload.eventType === "INSERT") {
              const lab = labelsIndex[payload.new.label_id];
              if (lab) {
                copy[cardId] = [...(copy[cardId] ?? []), lab];
              }
            } else if (payload.eventType === "DELETE") {
              copy[cardId] = (copy[cardId] ?? []).filter(
                (l) => l.id !== payload.old.label_id
              );
            }
            return copy;
          });
        }
      )
      .subscribe();
    // attachments realtime
    const channel3 = supabase
      .channel(`attachments:${boardId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attachments" },
        (payload: any) => {
          const cardId = (payload.new?.card_id ??
            payload.old?.card_id) as string;
          setAttachmentsCountByCard((prev) => {
            const copy = { ...prev };
            if (payload.eventType === "INSERT") {
              copy[cardId] = (copy[cardId] ?? 0) + 1;
            } else if (payload.eventType === "DELETE") {
              copy[cardId] = Math.max(0, (copy[cardId] ?? 1) - 1);
            }
            return copy;
          });
        }
      )
      .subscribe();
    // comments realtime
    const channel4 = supabase
      .channel(`comments:${boardId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "card_comments" },
        (payload: any) => {
          const cardId = (payload.new?.card_id ??
            payload.old?.card_id) as string;
          setCommentsCountByCard((prev) => {
            const copy = { ...prev };
            if (payload.eventType === "INSERT")
              copy[cardId] = (copy[cardId] ?? 0) + 1;
            else if (payload.eventType === "DELETE")
              copy[cardId] = Math.max(0, (copy[cardId] ?? 1) - 1);
            return copy;
          });
        }
      )
      .subscribe();
    // card_members realtime
    const channel5 = supabase
      .channel(`members:${boardId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "card_members" },
        async (payload: any) => {
          const cardId = (payload.new?.card_id ?? payload.old?.card_id) as string;
          // garante que o card pertence a este board
          const exists = Object.values(cardsByList).some((arr) => (arr ?? []).some((c) => c.id === cardId));
          if (!exists) return;
          if (payload.eventType === "INSERT") {
            try {
              const userId = payload.new.user_id as string;
              const { data: prof } = await supabase.from("user_profiles").select("id, display_name, avatar_url").eq("id", userId).maybeSingle();
              setMembersByCard((prev) => {
                const copy = { ...prev };
                const arr = copy[cardId] ?? [];
                copy[cardId] = [
                  ...arr,
                  { id: userId, name: prof?.display_name ?? null, avatar_url: prof?.avatar_url ?? null },
                ];
                return copy;
              });
            } catch {}
          } else if (payload.eventType === "DELETE") {
            const userId = payload.old.user_id as string;
            setMembersByCard((prev) => {
              const copy = { ...prev };
              copy[cardId] = (copy[cardId] ?? []).filter((m) => (m as any).id !== userId);
              return copy;
            });
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(channel2);
      supabase.removeChannel(channel3);
      supabase.removeChannel(channel4);
      supabase.removeChannel(channel5);
    };
  }, [boardId, supabase, cardsByList, labelsIndex]);

  // Listener opcional para forçar refresh de meta (labels/comentários) de um cartão
  useEffect(() => {
    async function onRefreshMeta(e: any) {
      const cardId = e?.detail?.cardId as string | undefined;
      if (!cardId) return;
      const { data: cls } = await supabase
        .from("card_labels")
        .select("label_id")
        .eq("card_id", cardId);
      const labs = (cls ?? [])
        .map((x: any) => labelsIndex[x.label_id])
        .filter(Boolean);
      setLabelsByCard((prev) => ({ ...prev, [cardId]: labs as any }));
      const { count } = await supabase
        .from("card_comments")
        .select("*", { count: "exact", head: true })
        .eq("card_id", cardId);
      setCommentsCountByCard((prev) => ({
        ...prev,
        [cardId]: typeof count === "number" ? count : prev[cardId] ?? 0,
      }));
    }
    window.addEventListener("card:refresh-meta", onRefreshMeta as any);
    return () =>
      window.removeEventListener("card:refresh-meta", onRefreshMeta as any);
  }, [supabase, labelsIndex]);

  async function addList() {
    const name = prompt("Nome da lista:")?.trim();
    if (!name) return;
    const maxPos = lists.length ? Math.max(...lists.map((l) => l.position)) : 0;
    await supabase
      .from("lists")
      .insert({ name, board_id: boardId, position: maxPos + 100 });
  }

  async function addCard(listId: string, title: string) {
    const t = title.trim();
    if (!t) return;
    const cards = cardsByList[listId] ?? [];
    const maxPos = cards.length ? Math.max(...cards.map((c) => c.position)) : 0;
    const now = new Date();
    const start_date = settings.auto_start_on_create ? now.toISOString() : null;
    const due_date =
      settings.due_offset_minutes > 0
        ? new Date(
            now.getTime() + settings.due_offset_minutes * 60000
          ).toISOString()
        : null;
    await fetch("/api/cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: t,
        board_id: boardId,
        list_id: listId,
        position: maxPos + 100,
        description: null,
        due_date,
      }),
    });
  }

  // Filtros do quadro
  const [filters, setFilters] = useState<{
    query: string;
    labelIds: string[];
    memberIds: string[];
    due: "all" | "overdue" | "today" | "week" | "none";
  }>({
    query: "",
    labelIds: [],
    memberIds: [],
    due: "all",
  });
  const labelsAnchorRef = React.useRef<HTMLButtonElement | null>(null);
  const membersAnchorRef = React.useRef<HTMLButtonElement | null>(null);
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);

  const allMembers = useMemo(() => {
    const map = new Map<string, { id: string; name: string | null }>();
    for (const key of Object.keys(membersByCard)) {
      const arr = (membersByCard as any)[key] as any[];
      for (const m of arr ?? []) {
        if (!m?.id) continue;
        if (!map.has(m.id)) map.set(m.id, { id: m.id, name: m.name ?? null });
      }
    }
    return Array.from(map.values());
  }, [membersByCard]);

  function cardMatchesFilters(card: Card) {
    const q = filters.query.trim().toLowerCase();
    if (q) {
      const title = (card.title ?? "").toLowerCase();
      const desc = (card.description ?? "").toLowerCase();
      if (!title.includes(q) && !desc.includes(q)) return false;
    }
    if (filters.labelIds.length) {
      const labs = labelsByCard[card.id] ?? [];
      const labSet = new Set(labs.map((l) => l.id));
      const match = filters.labelIds.some((id) => labSet.has(id));
      if (!match) return false;
    }
    if (filters.memberIds.length) {
      const ms = membersByCard[card.id] ?? [];
      const mSet = new Set(ms.map((m) => m.id).filter(Boolean) as string[]);
      const match = filters.memberIds.some((id) => mSet.has(id));
      if (!match) return false;
    }
    if (filters.due !== "all") {
      const d = card.due_date ? new Date(card.due_date) : null;
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      if (filters.due === "none") {
        if (d) return false;
      } else if (!d) {
        return false;
      } else if (filters.due === "overdue") {
        if (d.getTime() >= now.getTime()) return false;
      } else if (filters.due === "today") {
        if (d.getTime() < startOfToday.getTime() || d.getTime() > endOfToday.getTime()) return false;
      } else if (filters.due === "week") {
        const in7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        if (d.getTime() < startOfToday.getTime() || d.getTime() > in7.getTime()) return false;
      }
    }
    return true;
  }

  function findCardLocation(
    cardId: string
  ): { listIndex: number; cardIndex: number } | null {
    for (let i = 0; i < lists.length; i++) {
      const cs = cardsByList[lists[i].id] ?? [];
      const idx = cs.findIndex((c) => c.id === cardId);
      if (idx >= 0) return { listIndex: i, cardIndex: idx };
    }
    return null;
  }

  function computePosition(prev?: number, next?: number) {
    if (prev != null && next != null) return (prev + next) / 2;
    if (prev != null) return prev + 100;
    if (next != null) return next - 100;
    return 100;
  }

  function onDragStart(event: DragStartEvent) {
    const id = String(event.active.id);
    setActiveDragId(id);
    if (id.startsWith("container:")) {
      setDraggingListId(id.replace("container:", ""));
    }
  }

  function onDragOver(event: any) {
    const overId = event.over?.id ? String(event.over.id) : null;
    const activeId = event.active?.id ? String(event.active.id) : null;
    if (!overId || !activeId) return;
    if (activeId.startsWith("container:")) {
      let toListId = overId;
      if (overId.startsWith("container:"))
        toListId = overId.replace("container:", "");
      else if (overId.startsWith("list:"))
        toListId = overId.replace("list:", "");
      setOverListId(toListId);
    } else {
      setOverListId(null);
    }
  }

  async function onDragEnd(event: DragEndEvent) {
    setActiveDragId(null);
    setDraggingListId(null);
    setOverListId(null);
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id); // format: <listId>:<cardId>
    const overId = String(over.id); // pode ser list:<listId> OU <listId>:<cardId>
    // Reordenar listas (mesmo quando over é o droppable interno da lista)
    if (activeId.startsWith("container:")) {
      const fromListId = activeId.replace("container:", "");
      let toListId = overId;
      if (overId.startsWith("container:"))
        toListId = overId.replace("container:", "");
      else if (overId.startsWith("list:"))
        toListId = overId.replace("list:", "");
      else toListId = overId;
      if (!toListId || fromListId === toListId) return;
      const fromIndex = lists.findIndex((l) => l.id === fromListId);
      const toIndex = lists.findIndex((l) => l.id === toListId);
      if (fromIndex < 0 || toIndex < 0) return;
      const next = [...lists];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      setLists(next);
      const prevPos = toIndex > 0 ? next[toIndex - 1].position : undefined;
      const nextPos =
        toIndex < next.length - 1 ? next[toIndex + 1].position : undefined;
      const newPos = computePosition(prevPos, nextPos);
      await supabase
        .from("lists")
        .update({ position: newPos })
        .eq("id", moved.id);
      return;
    }
    // Reordenar listas
    if (activeId.startsWith("container:") && overId.startsWith("container:")) {
      const fromListId = activeId.replace("container:", "");
      const toListId = overId.replace("container:", "");
      if (fromListId !== toListId) {
        const fromIndex = lists.findIndex((l) => l.id === fromListId);
        const toIndex = lists.findIndex((l) => l.id === toListId);
        if (fromIndex >= 0 && toIndex >= 0) {
          const next = [...lists];
          const [moved] = next.splice(fromIndex, 1);
          next.splice(toIndex, 0, moved);
          setLists(next);
          const prevPos = toIndex > 0 ? next[toIndex - 1].position : undefined;
          const nextPos =
            toIndex < next.length - 1 ? next[toIndex + 1].position : undefined;
          const newPos = computePosition(prevPos, nextPos);
          await supabase
            .from("lists")
            .update({ position: newPos })
            .eq("id", moved.id);
        }
      }
      return;
    }
    const activeParts = activeId.split(":");
    const fromListId = activeParts[0];
    const cardId = activeParts[1];
    let toListId: string;
    if (overId.startsWith("list:")) {
      toListId = overId.replace("list:", "");
    } else if (overId.startsWith("container:")) {
      // quando o alvo é o container externo da lista (sortable das listas)
      toListId = overId.replace("container:", "");
    } else {
      // formato <listId>:<cardId>
      toListId = overId.split(":")[0];
    }
    // sanity: garante que é uma lista válida
    if (!lists.some((l) => l.id === toListId)) return;
    const targetListCards = (cardsByList[toListId] ?? []).filter(
      (c) => c.id !== cardId
    );

    // índice de inserção: se estiver sobre um card, antes dele; se sobre a lista, no final
    let insertIndex = targetListCards.length;
    if (!overId.startsWith("list:") && !overId.startsWith("container:")) {
      const overCardId = overId.split(":")[1];
      const idx = targetListCards.findIndex((c) => c.id === overCardId);
      if (idx >= 0) insertIndex = idx;
    }
    // calcula posição nova pela média dos vizinhos
    const prevPos =
      insertIndex > 0 ? targetListCards[insertIndex - 1].position : undefined;
    const nextPos =
      insertIndex < targetListCards.length
        ? targetListCards[insertIndex]?.position
        : undefined;
    const newPos = computePosition(prevPos, nextPos);

    // UI otimista com possibilidade de rollback
    const prevState = cardsByList;
    const nextState: Record<string, Card[]> = {};
    for (const k of Object.keys(prevState))
      nextState[k] = [...(prevState[k] ?? [])];
    // remove do antigo
    for (const k of Object.keys(nextState)) {
      nextState[k] = (nextState[k] ?? []).filter((c) => c.id !== cardId);
    }
    // pega dados do card para manter metadados
    const moved = (prevState[fromListId] ?? []).find((c) => c.id === cardId);
    if (!moved) return;
    const newCard: Card = { ...moved, list_id: toListId, position: newPos };
    const arr = nextState[toListId] ?? [];
    arr.splice(insertIndex, 0, newCard);
    nextState[toListId] = arr;
    setCardsByList(nextState);

    // persistência via API (service role) — evita bloqueios de RLS
    try {
      const res = await fetch("/api/cards/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: cardId,
          list_id: toListId,
          position: newPos,
        }),
      });
      if (!res.ok) {
        // rollback se falhar
        setCardsByList(prevState);
      }
    } catch {
      setCardsByList(prevState);
    }
  }

  return (
    <div className="px-6 mt-4 h-full flex flex-col gap-3">
      <div className="w-full bg-white/80 backdrop-blur border border-neutral-200 rounded-xl px-3 py-2 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-2">
            <Filter size={16} />
            <span className="text-sm font-medium">Filtros</span>
          </div>
          <input
            className="border rounded px-2 py-1 text-sm"
            placeholder="Buscar (título ou descrição)"
            value={filters.query}
            onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))}
          />
          <button
            ref={labelsAnchorRef}
            className="px-2 py-1 text-sm rounded border hover:bg-neutral-50"
            onClick={() => setLabelsOpen(true)}
            title="Filtrar por etiquetas"
          >
            Etiquetas
          </button>
          <Popover
            open={labelsOpen}
            onClose={() => setLabelsOpen(false)}
            anchorRect={labelsAnchorRef.current?.getBoundingClientRect()}
            width={260}
          >
            <div className="p-2 space-y-1">
              <div className="text-sm font-semibold px-1">Etiquetas</div>
              <div className="max-h-60 overflow-auto pr-1">
                {Object.values(labelsIndex).length === 0 && (
                  <div className="text-sm text-neutral-500 px-1 py-1">Nenhuma etiqueta</div>
                )}
                {Object.values(labelsIndex).map((l) => (
                  <label key={l.id} className="flex items-center gap-2 px-1 py-1 text-sm">
                    <input
                      type="checkbox"
                      checked={filters.labelIds.includes(l.id)}
                      onChange={(e) => {
                        setFilters((f) => {
                          const set = new Set(f.labelIds);
                          if (e.target.checked) set.add(l.id);
                          else set.delete(l.id);
                          return { ...f, labelIds: Array.from(set) };
                        });
                      }}
                    />
                    <span
                      className="inline-block h-3 w-6 rounded-full border"
                      style={{ backgroundColor: l.color }}
                    />
                    <span className="truncate">{l.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </Popover>
          <button
            ref={membersAnchorRef}
            className="px-2 py-1 text-sm rounded border hover:bg-neutral-50"
            onClick={() => setMembersOpen(true)}
            title="Filtrar por membros"
          >
            Membros
          </button>
          <Popover
            open={membersOpen}
            onClose={() => setMembersOpen(false)}
            anchorRect={membersAnchorRef.current?.getBoundingClientRect()}
            width={260}
          >
            <div className="p-2 space-y-1">
              <div className="text-sm font-semibold px-1">Membros</div>
              <div className="max-h-60 overflow-auto pr-1">
                {allMembers.length === 0 && (
                  <div className="text-sm text-neutral-500 px-1 py-1">Nenhum membro</div>
                )}
                {allMembers.map((m) => (
                  <label key={m.id} className="flex items-center gap-2 px-1 py-1 text-sm">
                    <input
                      type="checkbox"
                      checked={filters.memberIds.includes(m.id)}
                      onChange={(e) => {
                        setFilters((f) => {
                          const set = new Set(f.memberIds);
                          if (e.target.checked) set.add(m.id);
                          else set.delete(m.id);
                          return { ...f, memberIds: Array.from(set) };
                        });
                      }}
                    />
                    <span className="truncate">{m.name ?? m.id}</span>
                  </label>
                ))}
              </div>
            </div>
          </Popover>
          <select
            className="border rounded px-2 py-1 text-sm"
            value={filters.due}
            onChange={(e) => setFilters((f) => ({ ...f, due: e.target.value as any }))}
            title="Vencimento"
          >
            <option value="all">Todas as datas</option>
            <option value="overdue">Atrasados</option>
            <option value="today">Hoje</option>
            <option value="week">Próximos 7 dias</option>
            <option value="none">Sem data</option>
          </select>
          <Button
            variant="ghost"
            onClick={() => setFilters({ query: "", labelIds: [], memberIds: [], due: "all" })}
          >
            Limpar
          </Button>
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto overflow-y-hidden pb-6 h-full">
      <DndContext
        sensors={sensors}
        collisionDetection={rectIntersection}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
      >
        <div className="flex items-start gap-4">
          <SortableContext
            items={lists.map((l) => `container:${l.id}`)}
            strategy={horizontalListSortingStrategy}
          >
            {lists.map((l) => (
              <>
                {draggingListId && overListId === l.id && (
                  <div className="w-80 min-w-[20rem] rounded-xl border-2 border-dashed border-sky-400 bg-sky-100/30 h-12 self-stretch" />
                )}
                <KanbanList
                  key={l.id}
                  list={l}
                  boardId={boardId}
                  workspaceId={workspaceId}
                  cards={
                    (cardsByList[l.id] ?? [])
                      .filter(cardMatchesFilters)
                      .map((c) => ({
                      ...c,
                      onOpen: () => setOpenCardId(c.id),
                      members: membersByCard[c.id] ?? [],
                      labels: labelsByCard[c.id] ?? [],
                      attachmentsCount: attachmentsCountByCard[c.id] ?? 0,
                      commentsCount: commentsCountByCard[c.id] ?? 0,
                    })) as any
                  }
                  onAddCard={(title) => addCard(l.id, title)}
                  allLists={lists}
                  onMoveList={async (dir) => {
                    const idx = lists.findIndex((x) => x.id === l.id);
                    const swapIdx = dir === "left" ? idx - 1 : idx + 1;
                    if (swapIdx < 0 || swapIdx >= lists.length) return;
                    const a = lists[idx];
                    const b = lists[swapIdx];
                    // UI otimista
                    setLists((prev) => {
                      const copy = [...prev];
                      copy[idx] = b;
                      copy[swapIdx] = a;
                      return copy;
                    });
                    // troca posições no banco
                    await Promise.all([
                      supabase
                        .from("lists")
                        .update({ position: b.position })
                        .eq("id", a.id),
                      supabase
                        .from("lists")
                        .update({ position: a.position })
                        .eq("id", b.id),
                    ]);
                  }}
                  onCopyList={async () => {
                    await fetch("/api/lists/copy", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        list_id: l.id,
                        target_board_id: boardId,
                        name: `${l.name} (Cópia)`,
                      }),
                    });
                  }}
                  onMoveListTo={async (
                    targetBoardId: string,
                    positionIndex: number
                  ) => {
                    // UI otimista
                    const prevLists = lists;
                    const prevCardsByList = cardsByList;
                    try {
                      if (targetBoardId === boardId) {
                        // mover dentro do mesmo quadro: reordenar localmente pelo índice escolhido
                        const fromIdx = lists.findIndex((x) => x.id === l.id);
                        const toIdx = Math.min(
                          Math.max(positionIndex - 1, 0),
                          lists.length - 1
                        );
                        if (fromIdx !== -1 && toIdx !== fromIdx) {
                          const next = [...lists];
                          const [moved] = next.splice(fromIdx, 1);
                          next.splice(toIdx, 0, moved);
                          setLists(next);
                        }
                      } else {
                        // mover para outro quadro: remove localmente
                        setLists((prev) => prev.filter((x) => x.id !== l.id));
                        const { [l.id]: _removed, ...rest } =
                          cardsByList as any;
                        setCardsByList(rest);
                      }
                      // persistir no servidor
                      await fetch("/api/lists/move", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          list_id: l.id,
                          target_board_id: targetBoardId,
                          positionIndex,
                        }),
                      });
                    } catch {
                      // rollback
                      setLists(prevLists);
                      setCardsByList(prevCardsByList);
                    }
                  }}
                  onMoveAllCards={async (targetListId) => {
                    const fromCards = (cardsByList[l.id] ?? [])
                      .slice()
                      .sort((a, b) => a.position - b.position);
                    // UI otimista
                    setCardsByList((prev) => {
                      const copy: Record<string, Card[]> = {};
                      for (const k of Object.keys(prev))
                        copy[k] = [...(prev[k] ?? [])];
                      const moving = copy[l.id] ?? [];
                      copy[targetListId] = [
                        ...(copy[targetListId] ?? []),
                        ...moving.map((c, i) => ({
                          ...c,
                          list_id: targetListId,
                          position: (i + 1) * 100,
                        })),
                      ];
                      copy[l.id] = [];
                      return copy;
                    });
                    for (let i = 0; i < fromCards.length; i++) {
                      await supabase
                        .from("cards")
                        .update({
                          list_id: targetListId,
                          position: (i + 1) * 100,
                        })
                        .eq("id", fromCards[i].id);
                    }
                  }}
                  onSortList={async (mode) => {
                    const cards = (cardsByList[l.id] ?? []).slice();
                    if (mode === "created" || mode === "created_desc")
                      cards.sort((a: any, b: any) =>
                        mode === "created_desc"
                          ? new Date(b.created_at).getTime() -
                            new Date(a.created_at).getTime()
                          : new Date(a.created_at).getTime() -
                            new Date(b.created_at).getTime()
                      );
                    if (mode === "due")
                      cards.sort(
                        (a: any, b: any) =>
                          (a.due_date
                            ? new Date(a.due_date).getTime()
                            : Infinity) -
                          (b.due_date
                            ? new Date(b.due_date).getTime()
                            : Infinity)
                      );
                    if (mode === "alpha")
                      cards.sort((a: any, b: any) =>
                        (a.title || "").localeCompare(b.title || "", "pt-BR", {
                          sensitivity: "base",
                        })
                      );
                    // UI otimista
                    setCardsByList((prev) => ({
                      ...prev,
                      [l.id]: cards.map((c, i) => ({
                        ...c,
                        position: (i + 1) * 100,
                      })),
                    }));
                    // persistir
                    for (let i = 0; i < cards.length; i++) {
                      await supabase
                        .from("cards")
                        .update({ position: (i + 1) * 100 })
                        .eq("id", cards[i].id);
                    }
                  }}
                  onArchiveList={async () => {
                    if (!confirm("Arquivar esta lista e seus cartões?")) return;
                    // remove cartões primeiro
                    const cards = cardsByList[l.id] ?? [];
                    for (const c of cards) {
                      await supabase.from("cards").delete().eq("id", c.id);
                    }
                    // UI otimista: remove a lista localmente
                    setLists((prev) => prev.filter((x) => x.id !== l.id));
                    const { [l.id]: _removed, ...rest } = cardsByList as any;
                    setCardsByList(rest);
                    await supabase.from("lists").delete().eq("id", l.id);
                  }}
                  onArchiveAllCards={async () => {
                    const cards = (cardsByList[l.id] ?? []).slice();
                    // UI otimista: esvazia a lista local
                    setCardsByList((prev) => {
                      const copy = { ...prev };
                      copy[l.id] = [];
                      return copy;
                    });
                    // persistir: soft delete (arquivar)
                    const ids = cards.map((c) => c.id);
                    if (ids.length) {
                      const now = new Date().toISOString();
                      await supabase
                        .from("cards")
                        .update({ archived_at: now })
                        .in("id", ids);
                    }
                  }}
                />
              </>
            ))}
          </SortableContext>
          <button
            onClick={addList}
            className="w-80 min-w-[20rem] h-fit bg-white/80 backdrop-blur border border-dashed border-neutral-300 hover:border-neutral-400 hover:bg-white transition rounded-xl p-4 text-left flex items-center gap-2"
          >
            <Plus size={18} />
            <span>Nova lista</span>
          </button>
        </div>
        <DragOverlay>
          {activeDragId?.startsWith("container:") ? (
            <div className="w-80 pointer-events-none">
              <div className="rounded-xl border bg-white shadow-lg">
                <div className="flex items-center justify-between px-3 py-2 border-b">
                  <div className="font-medium">Mover lista</div>
                </div>
                <div className="p-3 text-sm text-neutral-500">...</div>
              </div>
            </div>
          ) : activeOverlay ? (
            <div className="w-80 pointer-events-none">
              <KanbanCard
                card={activeOverlay.card as any}
                listId={activeOverlay.listId}
                dueSoonThresholdMinutes={settings.due_soon_threshold_minutes}
                isOverlay
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
      <CardModal
        cardId={openCardId ?? ""}
        boardId={boardId}
        open={!!openCardId}
        onClose={() => setOpenCardId(null)}
      />
    </div>
    </div>
  );
}
