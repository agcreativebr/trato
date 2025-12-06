"use client";

import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  PointerSensor,
  closestCenter,
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
import { Plus } from "lucide-react";
import { CardModal } from "@/components/card/CardModal";
import { AvatarStack } from "@/components/ui/Avatar";
import { setCachedSignedUrl } from "@/lib/storage-url-cache";

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
}: {
  boardId: string;
  workspaceId: string;
}) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [lists, setLists] = useState<List[]>([]);
  const [cardsByList, setCardsByList] = useState<Record<string, Card[]>>({});
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [membersByCard, setMembersByCard] = useState<
    Record<string, { name?: string | null; avatar_url?: string | null }[]>
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
        .order("position", { ascending: true });
      if (!mounted) return;
      setLists(ls ?? []);
      const map: Record<string, Card[]> = {};
      for (const l of ls ?? []) {
        map[l.id] = (cs ?? []).filter((c) => c.list_id === l.id);
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
      const cardIds = (cs ?? []).map((c) => c.id);
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
          { name?: string | null; avatar_url?: string | null }[]
        > = {};
        for (const c of cm ?? []) {
          byCard[c.card_id] = byCard[c.card_id] ?? [];
          const prof = pMap.get(c.user_id);
          byCard[c.card_id].push({
            name: prof?.display_name ?? null,
            avatar_url: prof?.avatar_url ?? null,
          });
        }
        setMembersByCard(byCard);
      }
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
        const lab = labelMap.get(cl.label_id);
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
    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(channel2);
      supabase.removeChannel(channel3);
      supabase.removeChannel(channel4);
    };
  }, [boardId, supabase, cardsByList, labelsIndex]);

  async function addList() {
    const name = prompt("Nome da lista:")?.trim();
    if (!name) return;
    const maxPos = lists.length ? Math.max(...lists.map((l) => l.position)) : 0;
    await supabase
      .from("lists")
      .insert({ name, board_id: boardId, position: maxPos + 100 });
  }

  async function addCard(listId: string) {
    const title = prompt("Título do cartão:")?.trim();
    if (!title) return;
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
    await supabase.from("cards").insert({
      title,
      board_id: boardId,
      list_id: listId,
      position: maxPos + 100,
      start_date,
      due_date,
    });
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
    setActiveDragId(String(event.active.id));
  }

  async function onDragEnd(event: DragEndEvent) {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id); // format: <listId>:<cardId>
    const overId = String(over.id); // pode ser list:<listId> OU <listId>:<cardId>
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
    const toListId = overId.startsWith("list:")
      ? overId.replace("list:", "")
      : overId.split(":")[0];
    const targetListCards = (cardsByList[toListId] ?? []).filter(
      (c) => c.id !== cardId
    );

    // índice de inserção: se estiver sobre um card, antes dele; se sobre a lista, no final
    let insertIndex = targetListCards.length;
    if (!overId.startsWith("list:")) {
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

    // UI otimista
    setCardsByList((prev) => {
      const copy: Record<string, Card[]> = {};
      for (const k of Object.keys(prev)) copy[k] = [...(prev[k] ?? [])];
      // remove do antigo
      for (const k of Object.keys(copy)) {
        copy[k] = (copy[k] ?? []).filter((c) => c.id !== cardId);
      }
      // pega dados do card para manter metadados
      let moved: Card | undefined;
      const fromArr = prev[fromListId] ?? [];
      moved = fromArr.find((c) => c.id === cardId);
      if (!moved) return prev;
      const newCard: Card = { ...moved, list_id: toListId, position: newPos };
      const arr = copy[toListId] ?? [];
      arr.splice(insertIndex, 0, newCard);
      copy[toListId] = arr;
      return copy;
    });

    // atualiza no banco em background
    supabase
      .from("cards")
      .update({ list_id: toListId, position: newPos })
      .eq("id", cardId);
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-6 px-6">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className="flex items-start gap-4">
          <SortableContext
            items={lists.map((l) => `container:${l.id}`)}
            strategy={horizontalListSortingStrategy}
          >
            {lists.map((l) => (
              <KanbanList
                key={l.id}
                list={l}
                cards={
                  (cardsByList[l.id] ?? []).map((c) => ({
                    ...c,
                    onOpen: () => setOpenCardId(c.id),
                    members: membersByCard[c.id] ?? [],
                    labels: labelsByCard[c.id] ?? [],
                    attachmentsCount: attachmentsCountByCard[c.id] ?? 0,
                    commentsCount: commentsCountByCard[c.id] ?? 0,
                  })) as any
                }
                onAddCard={() => addCard(l.id)}
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
                  const name = `${l.name} (Cópia)`;
                  const maxPos = lists.length
                    ? Math.max(...lists.map((x) => x.position))
                    : 0;
                  const { data: newList } = await supabase
                    .from("lists")
                    .insert({
                      name,
                      board_id: l.board_id,
                      position: maxPos + 100,
                    })
                    .select("*")
                    .single();
                  const cards = cardsByList[l.id] ?? [];
                  for (let i = 0; i < cards.length; i++) {
                    const c = cards[i];
                    await supabase.from("cards").insert({
                      title: c.title,
                      description: c.description,
                      board_id: c.board_id,
                      list_id: (newList as any).id,
                      position: (i + 1) * 100,
                      due_date: c.due_date,
                      start_date: c.start_date,
                    });
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
                  if (mode === "created")
                    cards.sort(
                      (a: any, b: any) =>
                        new Date(a.created_at).getTime() -
                        new Date(b.created_at).getTime()
                    );
                  if (mode === "due")
                    cards.sort(
                      (a: any, b: any) =>
                        (a.due_date
                          ? new Date(a.due_date).getTime()
                          : Infinity) -
                        (b.due_date ? new Date(b.due_date).getTime() : Infinity)
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
                  await supabase.from("lists").delete().eq("id", l.id);
                }}
              />
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
          {activeOverlay ? (
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
  );
}
