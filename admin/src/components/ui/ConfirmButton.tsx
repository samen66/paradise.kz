'use client';

import { useState, type ReactNode } from 'react';
import { buttonDanger } from './styles';

type Props = {
  onConfirm: () => unknown;
  question?: string;
  children: ReactNode;
  className?: string;
};

export default function ConfirmButton({ onConfirm, question = 'Удалить? Это действие необратимо.', children, className }: Props) {
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    if (!window.confirm(question)) {
      return;
    }

    setBusy(true);

    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  return (
    <button type="button" disabled={busy} onClick={handleClick} className={className ?? buttonDanger}>
      {children}
    </button>
  );
}
