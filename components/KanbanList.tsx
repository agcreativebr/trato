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
import { Plus, MoreHorizontal, ChevronLeft, ChevronRight } from "lucide-react";
import * as React from "react";
import { Popover } from "@/components/ui/Popover";

export function KanbanList({
  list,
  cards,
  onAddCard,
  allLists,
  onMoveList,
  onCopyList,
  onMoveAllCards,
  onSortList,
  onArchiveList,
}: {
  list: { id: string; name: string };
  cards: Card[];
  onAddCard: () => void;
  allLists: { id: string; name: string }[];
  onMoveList: (dir: "left" | "right") => void;
  onCopyList: () => void;
  onMoveAllCards: (targetListId: string) => void;
  onSortList: (mode: "created" | "due") => void;
  onArchiveList: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `list:${list.id}`,
    data: { listId: list.id },
  });
  const btnRef = React.useRef<HTMLButtonElement | null>(null);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [targetList, setTargetList] = React.useState<string | null>(null);
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
      {...attributes}
      {...listeners}
      style={style}
      className={`w-80 min-w-[20rem] bg-white/90 backdrop-blur border ${
        isOver ? "border-blue-400" : "border-neutral-200"
      } rounded-xl p-3 shadow-elevated hover:shadow-floating transition-all duration-250 ease-soft`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-medium tracking-tight">{list.name}</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={onAddCard}
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
        onClose={() => setMenuOpen(false)}
        anchorRect={btnRef.current?.getBoundingClientRect()}
        width={320}
      >
        <div className="text-sm font-semibold px-2 py-1">Ações da Lista</div>
        <div className="divide-y">
          <div className="py-1">
            <button
              className="w-full text-left px-2 py-1 hover:bg-neutral-50"
              onClick={() => {
                setMenuOpen(false);
                onAddCard();
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
            <div className="flex">
              <button
                className="flex-1 text-left px-2 py-1 hover:bg-neutral-50 inline-flex items-center gap-1"
                onClick={() => {
                  onMoveList("left");
                }}
              >
                <ChevronLeft size={14} /> Mover lista para a esquerda
              </button>
              <button
                className="flex-1 text-left px-2 py-1 hover:bg-neutral-50 inline-flex items-center gap-1"
                onClick={() => {
                  onMoveList("right");
                }}
              >
                Mover lista para a direita <ChevronRight size={14} />
              </button>
            </div>
            <div className="px-2 py-2">
              <div className="text-xs text-neutral-600 mb-1">
                Mover todos os cartões nesta lista
              </div>
              <div className="flex items-center gap-2">
                <select
                  className="flex-1 border rounded px-2 py-1"
                  value={targetList ?? ""}
                  onChange={(e) => setTargetList(e.target.value)}
                >
                  <option value="" disabled>
                    Selecione...
                  </option>
                  {allLists
                    .filter((l2) => l2.id !== list.id)
                    .map((l2) => (
                      <option key={l2.id} value={l2.id}>
                        {l2.name}
                      </option>
                    ))}
                </select>
                <button
                  className="text-xs px-2 py-1 border rounded hover:bg-neutral-50"
                  onClick={() => {
                    if (targetList) {
                      onMoveAllCards(targetList);
                      setMenuOpen(false);
                    }
                  }}
                >
                  Mover
                </button>
              </div>
            </div>
            <div className="px-2 py-2">
              <div className="text-xs text-neutral-600 mb-1">
                Ordenar por...
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="text-xs px-2 py-1 border rounded hover:bg-neutral-50"
                  onClick={() => {
                    onSortList("created");
                    setMenuOpen(false);
                  }}
                >
                  Criação
                </button>
                <button
                  className="text-xs px-2 py-1 border rounded hover:bg-neutral-50"
                  onClick={() => {
                    onSortList("due");
                    setMenuOpen(false);
                  }}
                >
                  Data de entrega
                </button>
              </div>
            </div>
            <button
              className="w-full text-left px-2 py-1 hover:bg-neutral-50"
              onClick={() => {
                onArchiveList();
                setMenuOpen(false);
              }}
            >
              Arquivar Esta Lista
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
      </Popover>
    </motion.div>
  );
}
