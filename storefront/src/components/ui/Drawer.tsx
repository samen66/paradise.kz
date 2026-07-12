"use client";

import { useEffect, useRef, type ReactNode } from "react";

const sideClasses = {
  left: "inset-y-0 left-0 w-80 max-w-[85vw] animate-[slide-right_0.3s_ease-out]",
  right: "inset-y-0 right-0 w-80 max-w-[85vw] animate-[slide-left_0.3s_ease-out]",
  bottom: "inset-x-0 bottom-0 max-h-[85vh] rounded-t-2xl animate-[slide-up_0.3s_ease-out]",
} as const;

export function Drawer({
  open,
  onClose,
  side = "left",
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  side?: keyof typeof sideClasses;
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

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
      className="fixed m-0 h-full w-full max-h-none max-w-none bg-transparent p-0 backdrop:bg-black/40 backdrop:backdrop-blur-sm"
    >
      <div className={`fixed overflow-y-auto bg-white shadow-xl ${sideClasses[side]}`}>
        <div className="p-5 sm:p-6">
          {title ? (
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
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
      </div>
    </dialog>
  );
}
