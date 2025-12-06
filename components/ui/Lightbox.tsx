"use client";
import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export function Lightbox({
  open,
  onClose,
  src,
  alt,
}: {
  open: boolean;
  onClose: () => void;
  src?: string | null;
  alt?: string;
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    // Usa captura para executar ANTES de outros handlers (ex.: modal)
    // e evitar que o modal feche antes da lightbox.
    const onKeyCapture = (e: Event) => {
      const kev = e as KeyboardEvent;
      if (kev.key === "Escape") {
        kev.preventDefault();
        // impede outros handlers (incluindo do modal) de rodarem
        // garantindo que a lightbox feche primeiro
        // @ts-ignore - método existe no Event
        kev.stopImmediatePropagation?.();
        kev.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyCapture, { capture: true });
    return () =>
      window.removeEventListener("keydown", onKeyCapture, {
        capture: true,
      } as any);
  }, [open, onClose]);
  if (!open || !src) return null;
  return createPortal(
    <div className="fixed inset-0 z-[9999]">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <img
          src={src}
          alt={alt ?? "preview"}
          className="max-h-full max-w-full rounded shadow-2xl"
        />
      </div>
      <button
        aria-label="Fechar"
        className="absolute top-4 right-4 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/90 hover:bg-white border shadow"
        onClick={onClose}
      >
        <X size={18} />
      </button>
    </div>,
    document.body
  );
}
