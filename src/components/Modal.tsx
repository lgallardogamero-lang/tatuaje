"use client";

import { useEffect, useRef } from "react";

/** Diálogo accesible sobre <dialog>: foco atrapado, Esc para cerrar y fondo bloqueado. */
export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby="modal-title"
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-auto w-[min(100%-2rem,34rem)] rounded-[12px] border border-line bg-panel p-0 text-bone backdrop:bg-black/70 backdrop:backdrop-blur-sm"
    >
      {open && (
        <div className="grid gap-5 p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <h2 id="modal-title" className="text-[1.9rem]">{title}</h2>
            <button type="button" className="btn btn-quiet -mr-2 -mt-1" onClick={onClose} aria-label="Cerrar">✕</button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
