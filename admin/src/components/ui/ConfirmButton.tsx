'use client';

import { useState, type ReactNode } from 'react';
import { buttonDanger } from './styles';

type Props = {
  onConfirm: () => unknown;
  question?: string;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  title?: string;
};

export default function ConfirmButton({ onConfirm, question = 'Удалить? Это действие необратимо.', children, className, disabled = false, title }: Props) {
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
    <button type="button" disabled={busy || disabled} title={title} onClick={handleClick} className={className ?? buttonDanger}>
      {children}
    </button>
  );
}
