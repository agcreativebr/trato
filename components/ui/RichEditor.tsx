"use client";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import BulletList from "@tiptap/extension-bullet-list";
import OrderedList from "@tiptap/extension-ordered-list";
import ListItem from "@tiptap/extension-list-item";
// Link/Underline/Heading já vêm com o StarterKit nesta versão; evitar duplicar
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
// Removido CodeBlockLowlight para evitar erro de runtime com lowlight
import { useEffect, useRef, useState } from "react";
import Mention from "@tiptap/extension-mention";
import tippy, { Instance } from "tippy.js";
import "tippy.js/dist/tippy.css";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Quote,
  Code,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link as LinkIcon,
  Smile,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Trash,
} from "lucide-react";

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
};

export function RichEditor({ value, onChange, placeholder }: Props) {
  const [linkMode, setLinkMode] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const emojis = [
    "😀",
    "😁",
    "😂",
    "🤣",
    "😊",
    "😍",
    "🤩",
    "🙌",
    "👍",
    "🔥",
    "🎯",
    "🚀",
    "💡",
    "✅",
    "❗",
    "⚠️",
    "⭐",
    "📌",
    "📎",
    "📁",
    "📝",
    "💬",
    "📷",
    "🎧",
  ];
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      // Desabilita listas internas do StarterKit para evitar conflitos e usa extensões dedicadas
      StarterKit.configure({
        bulletList: false,
        orderedList: false,
        listItem: false,
        heading: { levels: [1, 2, 3, 4] },
      }),
      BulletList,
      OrderedList,
      ListItem,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({ placeholder: placeholder ?? "Escreva aqui..." }),
      Mention.configure({
        HTMLAttributes: { class: "mention" },
        suggestion: {
          items: async ({ query }) => {
            const res = await fetch(
              `/api/user_profiles/search?q=${encodeURIComponent(query ?? "")}`
            );
            const json = await res.json();
            return (json.data ?? []).map((u: any) => ({
              id: u.id,
              label: u.display_name || "Usuário",
              avatar: u.avatar_url,
            }));
          },
          render: () => {
            let popup: Instance | null = null;
            let container: HTMLDivElement | null = null;
            return {
              onStart: (props) => {
                container = document.createElement("div");
                container.className = "bg-white border rounded shadow text-sm";
                update(props);
                if (props.clientRect) {
                  popup = tippy("body", {
                    getReferenceClientRect: props.clientRect as any,
                    appendTo: () => document.body,
                    content: container,
                    showOnCreate: true,
                    interactive: true,
                    trigger: "manual",
                    placement: "bottom-start",
                  })[0];
                }
              },
              onUpdate(props) {
                update(props);
                if (popup && props.clientRect) {
                  popup.setProps({
                    getReferenceClientRect: props.clientRect as any,
                  });
                }
              },
              onKeyDown(props) {
                if (props.event.key === "Escape") {
                  popup?.hide();
                  return true;
                }
                return false;
              },
              onExit() {
                popup?.destroy();
              },
            };
            function update(props: any) {
              if (!container) return;
              container.innerHTML = "";
              (props.items || []).forEach((item: any) => {
                const el = document.createElement("button");
                el.className =
                  "flex items-center gap-2 px-2 py-1 hover:bg-neutral-100 w-full";
                el.innerHTML = `<span class="w-5 h-5 rounded-full bg-neutral-200 overflow-hidden"><img src="${
                  item.avatar || ""
                }" onerror="this.style.display='none'" class="w-full h-full object-cover"/></span><span>${
                  item.label
                }</span>`;
                el.onclick = () =>
                  props.command({ id: item.id, label: item.label });
                container!.appendChild(el);
              });
            }
          },
        },
      }),
    ],
    content: value || "<p></p>",
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none p-3 min-h-[140px] focus:outline-none",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  useEffect(() => {
    if (!editor) return;
    // sincroniza quando valor externo muda (ex.: ao abrir modal)
    if (value && editor.getHTML() !== value) editor.commands.setContent(value);
  }, [value, editor]);

  if (!editor) return null;
  return (
    <div className="border rounded-md">
      <div className="flex flex-wrap items-center gap-1 p-2 border-b text-sm bg-neutral-50 rounded-t-md">
        <Toolbtn
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive("bold")}
          title="Negrito"
        >
          <Bold size={14} />
        </Toolbtn>
        <Toolbtn
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive("italic")}
          title="Itálico"
        >
          <Italic size={14} />
        </Toolbtn>
        <Toolbtn
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          active={editor.isActive("underline")}
          title="Sublinhar"
        >
          <UnderlineIcon size={14} />
        </Toolbtn>
        <span className="mx-1 h-5 w-px bg-neutral-200" />
        <Toolbtn
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive("bulletList")}
          title="Lista não ordenada"
        >
          <List size={14} />
        </Toolbtn>
        <Toolbtn
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive("orderedList")}
          title="Lista ordenada"
        >
          <ListOrdered size={14} />
        </Toolbtn>
        <Toolbtn
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive("blockquote")}
          title="Citar"
        >
          <Quote size={14} />
        </Toolbtn>
        <Toolbtn
          onClick={() => editor.chain().focus().toggleCode().run()}
          active={editor.isActive("code")}
          title="Código inline"
        >
          <Code size={14} />
        </Toolbtn>
        <span className="mx-1 h-5 w-px bg-neutral-200" />
        <Toolbtn
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          active={editor.isActive({ textAlign: "left" })}
          title="Alinhar à esquerda"
        >
          <AlignLeft size={14} />
        </Toolbtn>
        <Toolbtn
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          active={editor.isActive({ textAlign: "center" })}
          title="Centralizar"
        >
          <AlignCenter size={14} />
        </Toolbtn>
        <Toolbtn
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          active={editor.isActive({ textAlign: "right" })}
          title="Alinhar à direita"
        >
          <AlignRight size={14} />
        </Toolbtn>
        <span className="mx-1 h-5 w-px bg-neutral-200" />
        <div className="inline-flex items-center gap-1">
          <Toolbtn
            onClick={() =>
              applyAcrossBlocks(editor, (ed) => toggleHeading(ed, 1))
            }
            active={editor.isActive("heading", { level: 1 })}
            title="H1"
          >
            <Heading1 size={14} />
          </Toolbtn>
          <Toolbtn
            onClick={() =>
              applyAcrossBlocks(editor, (ed) => toggleHeading(ed, 2))
            }
            active={editor.isActive("heading", { level: 2 })}
            title="H2"
          >
            <Heading2 size={14} />
          </Toolbtn>
          <Toolbtn
            onClick={() =>
              applyAcrossBlocks(editor, (ed) => toggleHeading(ed, 3))
            }
            active={editor.isActive("heading", { level: 3 })}
            title="H3"
          >
            <Heading3 size={14} />
          </Toolbtn>
          <Toolbtn
            onClick={() =>
              applyAcrossBlocks(editor, (ed) => toggleHeading(ed, 4))
            }
            active={editor.isActive("heading", { level: 4 })}
            title="H4"
          >
            <Heading4 size={14} />
          </Toolbtn>
        </div>
        <span className="mx-1">|</span>
        <Toolbtn
          onClick={() => {
            setLinkMode((v) => !v);
            setEmojiOpen(false);
          }}
          title="Inserir link"
        >
          <LinkIcon size={14} />
        </Toolbtn>
        <Toolbtn
          onClick={() => {
            setEmojiOpen((v) => !v);
            setLinkMode(false);
          }}
          title="Emoji"
        >
          <Smile size={14} />
        </Toolbtn>
      </div>
      {linkMode && (
        <div className="p-2 border-b flex items-center gap-2">
          <input
            className="flex-1 border rounded px-2 py-1 text-sm"
            placeholder="https://"
            value={linkValue}
            onChange={(e) => setLinkValue(e.target.value)}
          />
          <Toolbtn
            onClick={() => {
              editor
                ?.chain()
                .focus()
                .extendMarkRange("link")
                .setLink({ href: linkValue })
                .run();
              setLinkMode(false);
              setLinkValue("");
            }}
            title="Aplicar"
          >
            OK
          </Toolbtn>
          <Toolbtn
            onClick={() => {
              editor?.chain().focus().unsetLink().run();
              setLinkMode(false);
              setLinkValue("");
            }}
            title="Remover link"
          >
            <Trash size={14} />
          </Toolbtn>
        </div>
      )}
      <EditorContent editor={editor} />
      {emojiOpen && (
        <div className="p-2 border-t">
          <div className="grid grid-cols-10 gap-1">
            {emojis.map((e) => (
              <button
                key={e}
                className="h-7 w-7 hover:bg-neutral-100 rounded"
                onClick={() => {
                  editor?.chain().focus().insertContent(e).run();
                  setEmojiOpen(false);
                }}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Toolbtn({
  children,
  onClick,
  active,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-neutral-700 transition-colors ${
        active
          ? "bg-neutral-200/80 border-neutral-300"
          : "hover:bg-neutral-200/60"
      }`}
    >
      {children}
    </button>
  );
}

function toggleHeading(editor: any, level: 1 | 2 | 3 | 4) {
  if (!editor) return;
  if (editor.isActive("heading", { level })) {
    editor.chain().focus().setParagraph().run();
  } else {
    editor.chain().focus().toggleHeading({ level }).run();
  }
}

// Aplica comandos de bloco (heading/list/blockquote) para todas as linhas selecionadas
function applyAcrossBlocks(editor: any, apply: (ed: any) => void) {
  if (!editor) return;
  const { state } = editor;
  const { from, to } = state.selection;
  const positions: number[] = [];
  state.doc.nodesBetween(from, to, (node: any, pos: number) => {
    if (node.isBlock) positions.push(pos);
  });
  if (positions.length === 0) {
    apply(editor);
    return;
  }
  positions.forEach((pos) => {
    editor
      .chain()
      .focus()
      .setTextSelection({ from: pos + 1, to: pos + 1 })
      .run();
    apply(editor);
  });
}
