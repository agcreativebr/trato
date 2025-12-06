"use client";

import { useRef, useState } from "react";
import { Card } from "./KanbanBoard";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Calendar, Paperclip, FileText, MessageSquare } from "lucide-react";
import { AvatarStack } from "@/components/ui/Avatar";
import { useEffect } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-client";
import {
  getCachedSignedUrl,
  setCachedSignedUrl,
} from "@/lib/storage-url-cache";

export function KanbanCard({
  card,
  listId,
  dueSoonThresholdMinutes = 1440,
  isOverlay = false,
}: {
  card: Card & {
    members?: { name?: string | null; avatar_url?: string | null }[];
    labels?: { id: string; name: string; color: string }[];
    attachmentsCount?: number;
    commentsCount?: number;
  };
  listId: string;
  dueSoonThresholdMinutes?: number;
  isOverlay?: boolean;
}) {
  let attributes: any = {};
  let listeners: any = {};
  let setNodeRef: any = undefined;
  let style: React.CSSProperties | undefined = undefined;
  if (!isOverlay) {
    const sortable = useSortable({
      id: `${listId}:${card.id}`,
      data: { cardId: card.id, listId },
    });
    attributes = sortable.attributes;
    listeners = sortable.listeners;
    setNodeRef = sortable.setNodeRef;
    style = {
      transform: CSS.Transform.toString(sortable.transform),
      transition: sortable.transition,
      opacity: sortable.isDragging ? 0.6 : 1,
    };
  } else {
    style = { opacity: 0.95 };
  }
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!card.cover_path) {
        setCoverUrl(null);
        return;
      }
      // 1) tenta cache imediato para evitar flicker
      const cached = getCachedSignedUrl(card.cover_path);
      if (cached) {
        if (active) setCoverUrl(cached);
      }
      // 2) renova se não houver cache ou se estiver perto de expirar
      if (!cached) {
        const supabase = getSupabaseBrowserClient();
        const { data } = await supabase.storage
          .from("attachments")
          .createSignedUrl(card.cover_path, 60 * 10);
        const url = data?.signedUrl ?? null;
        if (url) setCachedSignedUrl(card.cover_path, url, 600);
        if (active) setCoverUrl(url);
      }
    })();
    return () => {
      active = false;
    };
  }, [card.cover_path]);

  async function handleAttach(file: File) {
    setUploading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const path = `${card.id}/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage
        .from("attachments")
        .upload(path, file);
      if (!error) {
        await supabase
          .from("attachments")
          .insert({ card_id: card.id, filename: file.name, path });
      }
    } finally {
      setUploading(false);
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`bg-white border border-neutral-200 rounded-lg shadow-elevated hover:shadow-floating transition-all duration-250 ease-soft ${
        isOverlay
          ? "scale-[1.02] shadow-lg ring-1 ring-neutral-300"
          : "hover:-translate-y-[1px]"
      }`}
    >
      {coverUrl && (
        <div
          className={`w-full ${
            card.cover_size === "large" ? "h-40 md:h-48" : "h-24"
          } rounded-t-lg overflow-hidden`}
        >
          <img
            src={coverUrl}
            alt="capa"
            className="w-full h-full object-cover"
          />
        </div>
      )}
      <div className="p-3">
        <div className="font-medium tracking-tight">{card.title}</div>
        {(card.start_date || card.due_date) &&
          renderDateBadge(card, dueSoonThresholdMinutes)}
        <div className="mt-2 flex items-center justify-between">
          {card.members && card.members.length > 0 && (
            <AvatarStack users={card.members} size={18} />
          )}
          <button
            className="text-xs underline"
            onClick={() => {
              inputRef.current?.click();
            }}
            disabled={uploading}
          >
            {uploading ? "Anexando..." : "Anexar"}
          </button>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleAttach(f);
            }}
          />
        </div>
        {/* meta icons row, Trello-like */}
        <div className="mt-2 flex items-center gap-3 text-neutral-700 text-[12px]">
          {card.description && (
            <span
              title="Este cartão tem uma descrição."
              className="inline-flex items-center gap-1"
            >
              <FileText size={14} />
            </span>
          )}
          {(card.attachmentsCount ?? 0) > 0 && (
            <span title="Anexos" className="inline-flex items-center gap-1">
              <Paperclip size={14} />
              {card.attachmentsCount}
            </span>
          )}
          {(card.commentsCount ?? 0) > 0 && (
            <span
              title="Comentários"
              className="inline-flex items-center gap-1"
            >
              <MessageSquare size={14} />
              {card.commentsCount}
            </span>
          )}
        </div>
        {card.labels && card.labels.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {card.labels.map((l) => (
              <span
                key={l.id}
                className="inline-block h-2.5 w-10 rounded-full"
                style={{ backgroundColor: l.color }}
                title={l.name}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function renderDateBadge(card: any, dueSoonThresholdMinutes: number) {
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  const now = Date.now();
  const due = card.due_date ? new Date(card.due_date).getTime() : null;
  let color = "bg-emerald-100 text-emerald-800";
  if (due) {
    if (due < now) color = "bg-red-100 text-red-800";
    else if (due - now <= dueSoonThresholdMinutes * 60000)
      color = "bg-amber-100 text-amber-800";
  }
  return (
    <div
      className={`mt-2 inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full ${color}`}
    >
      <Calendar size={12} />
      {card.start_date ? `${fmt(card.start_date)} - ` : ""}
      {card.due_date ? fmt(card.due_date) : ""}
    </div>
  );
}
