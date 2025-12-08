"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-client";
import { KanbanBoard } from "@/components/KanbanBoard";
import { useParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
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
            <Button
              variant="secondary"
              leftIcon={<Trash size={16} />}
              onClick={async () => {
                if (!confirm("Excluir este quadro? Esta ação é permanente."))
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
            </Button>
          </div>
        </div>
      </div>
      <KanbanBoard boardId={boardId} workspaceId={workspaceId} />
    </div>
  );
}
