"use client";

import { Card } from "./KanbanBoard";
import { KanbanCard } from "./KanbanCard";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "framer-motion";
import {
  Plus,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  GripHorizontal,
} from "lucide-react";
import * as React from "react";
import { Popover } from "@/components/ui/Popover";
import { getSupabaseBrowserClient } from "@/lib/supabase-client";

export function KanbanList({
  list,
  boardId,
  workspaceId,
  cards,
  onAddCard,
  allLists,
  onMoveList,
  onCopyList,
  onMoveListTo,
  onMoveAllCards,
  onSortList,
  onArchiveList,
}: {
  list: { id: string; name: string };
  boardId: string;
  workspaceId: string;
  cards: Card[];
  onAddCard: (title: string) => void;
  allLists: { id: string; name: string }[];
  onMoveList: (dir: "left" | "right") => void;
  onCopyList: () => void;
  onMoveListTo: (targetBoardId: string, positionIndex: number) => void;
  onMoveAllCards: (targetListId: string) => void;
  onSortList: (mode: "created" | "created_desc" | "due" | "alpha") => void;
  onArchiveList: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `list:${list.id}`,
    data: { listId: list.id },
  });
  const btnRef = React.useRef<HTMLButtonElement | null>(null);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [targetList, setTargetList] = React.useState<string | null>(null);
  const [composerOpen, setComposerOpen] = React.useState(false);
  const [newTitle, setNewTitle] = React.useState("");
  const [menuView, setMenuView] = React.useState<
    "root" | "move" | "sort" | "moveAll"
  >("root");
  const [boards, setBoards] = React.useState<{ id: string; name: string }[]>(
    []
  );
  const [targetBoard, setTargetBoard] = React.useState<string | null>(null);
  const [positionIdx, setPositionIdx] = React.useState<number>(1);
  const [positionCount, setPositionCount] = React.useState<number>(0);
  React.useEffect(() => {
    if (menuOpen && menuView === "move") {
      (async () => {
        const res = await fetch(`/api/boards?workspaceId=${workspaceId}`);
        const json = await res.json();
        const apiBoards: { id: string; name: string }[] = json.data ?? [];
        const containsCurrent = apiBoards.some((b) => b.id === boardId);
        const safeBoards =
          apiBoards.length > 0
            ? containsCurrent
              ? apiBoards
              : [{ id: boardId, name: "Quadro atual" }, ...apiBoards]
            : [{ id: boardId, name: "Quadro atual" }];
        setBoards(safeBoards);
        const initialTarget = containsCurrent
          ? boardId
          : safeBoards[0]?.id ?? boardId;
        setTargetBoard(initialTarget);
        setPositionCount(allLists.length);
        setPositionIdx(
          Math.min(positionIdx || 1, Math.max(allLists.length, 1))
        );
      })();
    }
  }, [menuOpen, menuView, workspaceId, boardId, allLists.length]);

  // Quando o quadro alvo mudar dentro do submenu, carregar a quantidade de listas desse quadro
  React.useEffect(() => {
    const loadCounts = async () => {
      if (!menuOpen || menuView !== "move" || !targetBoard) return;
      try {
        const supabase = getSupabaseBrowserClient();
        const { data: lists } = await supabase
          .from("lists")
          .select("id")
          .eq("board_id", targetBoard)
          .order("position", { ascending: true });
        const count = lists?.length ?? 0;
        setPositionCount(count);
        // Garante que o índice selecionado é válido para o quadro escolhido
        setPositionIdx((prev) => {
          const clamped = Math.min(Math.max(prev || 1, 1), Math.max(count, 1));
          return clamped;
        });
      } catch {
        // fallback: pelo menos uma posição
        setPositionCount(1);
        setPositionIdx(1);
      }
    };
    loadCounts();
  }, [targetBoard, menuOpen, menuView]);
  // inline rename state
  const [editingName, setEditingName] = React.useState(false);
  const [localName, setLocalName] = React.useState(list.name);
  React.useEffect(() => {
    setLocalName(list.name);
  }, [list.name]);
  // sortable para mover a lista horizontalmente
  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `container:${list.id}` });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.9 : 1,
  };
  return (
    <motion.div
      ref={setSortableRef as React.Ref<HTMLDivElement>}
      style={{ ...style, touchAction: "none" }}
      className={`w-80 min-w-[20rem] bg-white/90 backdrop-blur border ${
        isOver ? "border-blue-400" : "border-neutral-200"
      } rounded-xl p-3 shadow-elevated hover:shadow-floating transition-all duration-250 ease-soft`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="font-medium tracking-tight">
          {editingName ? (
            <input
              className="px-2 py-1 -mx-2 -my-1 rounded border focus:outline-none focus:ring-2 focus:ring-sky-500"
              autoFocus
              value={localName}
              onChange={(e) => setLocalName(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key === "Enter") {
                  setEditingName(false);
                  const name = localName.trim();
                  if (!name || name === list.name) return;
                  try {
                    await fetch("/api/lists", {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ id: list.id, name }),
                    });
                  } catch {}
                } else if (e.key === "Escape") {
                  setLocalName(list.name);
                  setEditingName(false);
                }
              }}
              onBlur={async () => {
                setEditingName(false);
                const name = localName.trim();
                if (!name || name === list.name) {
                  setLocalName(list.name);
                  return;
                }
                try {
                  await fetch("/api/lists", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: list.id, name }),
                  });
                } catch {}
              }}
            />
          ) : (
            <button
              className="text-left cursor-text"
              title="Clique para renomear"
              onClick={() => setEditingName(true)}
            >
              {localName}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-neutral-100 cursor-grab active:cursor-grabbing"
            title="Arrastar lista"
            {...attributes}
            {...listeners}
          >
            <GripHorizontal size={16} />
          </button>
          <button
            onClick={() => setComposerOpen(true)}
            className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded-md bg-neutral-100 hover:bg-neutral-200 transition-colors"
          >
            <Plus size={14} />
            Novo
          </button>
          <button
            ref={btnRef}
            onClick={() => setMenuOpen(true)}
            className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-neutral-100"
          >
            <MoreHorizontal size={16} />
          </button>
        </div>
      </div>
      {composerOpen && (
        <div className="mb-2">
          <textarea
            className="w-full border rounded-md px-3 py-2 text-sm"
            placeholder="Insira um título ou cole um link"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <div className="mt-2 flex items-center gap-2">
            <button
              className="px-3 py-1 rounded-md bg-sky-600 text-white text-sm hover:bg-sky-700"
              onClick={async () => {
                if (!newTitle.trim()) return;
                await onAddCard(newTitle);
                setNewTitle("");
                setComposerOpen(false);
              }}
            >
              Adicionar Cartão
            </button>
            <button
              className="px-2 py-1 rounded-md border text-sm"
              onClick={() => {
                setComposerOpen(false);
                setNewTitle("");
              }}
              title="Cancelar"
            >
              ×
            </button>
          </div>
        </div>
      )}
      <div className="space-y-2" ref={setNodeRef as React.Ref<HTMLDivElement>}>
        <SortableContext
          items={cards.map((c) => `${list.id}:${c.id}`)}
          strategy={verticalListSortingStrategy}
        >
          {cards.map((c) => (
            <div key={c.id} onClick={() => (c as any).onOpen?.()}>
              <KanbanCard card={c as any} listId={list.id} />
            </div>
          ))}
        </SortableContext>
      </div>
      <Popover
        open={menuOpen}
        onClose={() => {
          setMenuOpen(false);
          setMenuView("root");
        }}
        anchorRect={btnRef.current?.getBoundingClientRect()}
        width={320}
      >
        {menuView === "root" ? (
          <>
            <div className="text-sm font-semibold px-2 py-1">
              Ações da Lista
            </div>
            <div className="divide-y">
              <div className="py-1">
                <button
                  className="w-full text-left px-2 py-1 hover:bg-neutral-50"
                  onClick={() => {
                    setMenuOpen(false);
                    setComposerOpen(true);
                  }}
                >
                  Adicionar cartão
                </button>
                <button
                  className="w-full text-left px-2 py-1 hover:bg-neutral-50"
                  onClick={() => {
                    setMenuOpen(false);
                    onCopyList();
                  }}
                >
                  Copiar lista
                </button>
                <button
                  className="w-full text-left px-2 py-1 hover:bg-neutral-50"
                  onClick={() => setMenuView("move")}
                >
                  Mover lista…
                </button>
                <button
                  className="w-full text-left px-2 py-1 hover:bg-neutral-50"
                  onClick={() => setMenuView("sort")}
                >
                  Ordenar lista…
                </button>

                <button
                  className="w-full text-left px-2 py-1 hover:bg-neutral-50"
                  onClick={() => setMenuView("moveAll")}
                >
                  Mover todos os cartões…
                </button>
                <button
                  className="w-full text-left px-2 py-1 hover:bg-neutral-50"
                  onClick={() => {
                    if (
                      confirm(
                        "Deseja realmente excluir esta lista? Esta ação é permanente."
                      )
                    )
                      onArchiveList();
                    setMenuOpen(false);
                  }}
                >
                  Excluir lista
                </button>
              </div>
              <div className="py-1 opacity-60 pointer-events-none">
                <div className="px-2 py-1 text-xs">Automação (em breve)</div>
                <button className="w-full text-left px-2 py-1">Seguir</button>
                <button className="w-full text-left px-2 py-1">
                  Arquivar todos os cartões nesta lista
                </button>
              </div>
            </div>
          </>
        ) : null}

        {menuView === "move" ? (
          <div className="p-2">
            <div className="flex items-center justify-between mb-2">
              <button className="text-sm" onClick={() => setMenuView("root")}>
                ‹
              </button>
              <div className="text-sm font-semibold">Mover Lista</div>
              <button
                className="text-sm"
                onClick={() => {
                  setMenuOpen(false);
                  setMenuView("root");
                }}
              >
                ×
              </button>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-neutral-600">Quadro</label>
              <select
                className="w-full border rounded px-2 py-1"
                value={targetBoard ?? boards[0]?.id ?? ""}
                onChange={(e) => setTargetBoard(e.target.value)}
              >
                {boards.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              <label className="text-xs text-neutral-600">Posição</label>
              <select
                className="w-full border rounded px-2 py-1"
                value={String(positionIdx)}
                onChange={(e) => setPositionIdx(parseInt(e.target.value))}
              >
                {Array.from({ length: Math.max(positionCount, 1) }).map(
                  (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {i + 1}
                    </option>
                  )
                )}
              </select>
              <div className="flex items-center justify-between pt-1">
                <button
                  className="px-3 py-1 rounded-md bg-sky-600 text-white text-sm hover:bg-sky-700"
                  onClick={async () => {
                    if (!targetBoard) return;
                    await onMoveListTo(targetBoard, positionIdx);
                    setMenuOpen(false);
                    setMenuView("root");
                  }}
                >
                  Mover
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {menuView === "sort" ? (
          <div className="p-2">
            <div className="flex items-center justify-between mb-2">
              <button className="text-sm" onClick={() => setMenuView("root")}>
                ‹
              </button>
              <div className="text-sm font-semibold">Ordenar lista</div>
              <button
                className="text-sm"
                onClick={() => {
                  setMenuOpen(false);
                  setMenuView("root");
                }}
              >
                ×
              </button>
            </div>
            <div className="flex flex-col">
              <button
                className="text-left px-2 py-1 hover:bg-neutral-50"
                onClick={() => {
                  onSortList("created_desc");
                  setMenuOpen(false);
                  setMenuView("root");
                }}
              >
                Data de criação (mais recente primeiro)
              </button>
              <button
                className="text-left px-2 py-1 hover:bg-neutral-50"
                onClick={() => {
                  onSortList("created");
                  setMenuOpen(false);
                  setMenuView("root");
                }}
              >
                Data de criação (mais antigo primeiro)
              </button>
              <button
                className="text-left px-2 py-1 hover:bg-neutral-50"
                onClick={() => {
                  onSortList("alpha");
                  setMenuOpen(false);
                  setMenuView("root");
                }}
              >
                Nome do cartão (ordem alfabética)
              </button>
              <button
                className="text-left px-2 py-1 hover:bg-neutral-50"
                onClick={() => {
                  onSortList("due");
                  setMenuOpen(false);
                  setMenuView("root");
                }}
              >
                Data de entrega
              </button>
            </div>
          </div>
        ) : null}

        {menuView === "moveAll" ? (
          <div className="p-2">
            <div className="flex items-center justify-between mb-2">
              <button className="text-sm" onClick={() => setMenuView("root")}>
                ‹
              </button>
              <div className="text-sm font-semibold">
                Mover Todos os Cartões na Lista
              </div>
              <button
                className="text-sm"
                onClick={() => {
                  setMenuOpen(false);
                  setMenuView("root");
                }}
              >
                ×
              </button>
            </div>
            <div className="flex flex-col">
              {allLists.map((l2) => (
                <button
                  key={l2.id}
                  className={`text-left px-2 py-1 hover:bg-neutral-50 ${
                    l2.id === list.id
                      ? "text-neutral-400 pointer-events-none"
                      : ""
                  }`}
                  onClick={() => {
                    onMoveAllCards(l2.id);
                    setMenuOpen(false);
                    setMenuView("root");
                  }}
                >
                  {l2.name}
                  {l2.id === list.id ? " (atual)" : ""}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </Popover>
    </motion.div>
  );
}
