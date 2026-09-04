"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
      className="m-auto max-h-[85vh] w-full max-w-lg rounded-2xl border border-line bg-white p-0 shadow-xl backdrop:bg-black/40 backdrop:backdrop-blur-sm open:animate-[scale-in_0.2s_ease-out]"
    >
      <div className="p-6 sm:p-8">
        {title ? (
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold text-ink">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Закрыть"
              className="grid h-8 w-8 place-items-center rounded-full text-muted transition hover:bg-surface hover:text-ink"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-5 w-5" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        ) : null}
        {children}
      </div>
    </dialog>
  );
}
