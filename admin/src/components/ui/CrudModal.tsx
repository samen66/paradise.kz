'use client';

import { useId, useState, type ReactNode } from 'react';
import { useForm, type DefaultValues, type FieldValues, type Resolver, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ZodType } from 'zod';
import { applyServerErrors } from '@/lib/errors';
import { toast } from '@/stores/toastStore';
import Modal from './Modal';
import { buttonGhost, buttonPrimary } from './styles';

type CrudModalProps<T extends FieldValues> = {
  title: string;
  schema: ZodType<T, T>;
  defaultValues: DefaultValues<T>;
  onSubmit: (values: T) => Promise<unknown>;
  onClose: () => void;
  children: (form: UseFormReturn<T>) => ReactNode;
  submitLabel?: string;
};

export default function CrudModal<T extends FieldValues>({
  title,
  schema,
  defaultValues,
  onSubmit,
  onClose,
  children,
  submitLabel = 'Сохранить',
}: CrudModalProps<T>) {
  // Schemas here never coerce (numbers stay strings), so input and output
  // types coincide and the resolver can be narrowed to T.
  const form = useForm<T>({ resolver: zodResolver(schema) as unknown as Resolver<T>, defaultValues });
  const [formError, setFormError] = useState<string | null>(null);
  const formId = useId();

  const submit = form.handleSubmit(async (values) => {
    setFormError(null);

    try {
      await onSubmit(values);
      toast.success('Сохранено');
      onClose();
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError));
    }
  });

  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <div className="grid grid-cols-2 gap-2 md:flex md:justify-end">
          <button type="button" onClick={onClose} className={buttonGhost}>
            Отмена
          </button>
          {/* Кнопка вне <form> — связь через атрибут form; Enter в поле по-прежнему отправляет форму. */}
          <button type="submit" form={formId} disabled={form.formState.isSubmitting} className={buttonPrimary}>
            {form.formState.isSubmitting ? 'Сохранение…' : submitLabel}
          </button>
        </div>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="space-y-4">
        {formError && (
          <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {formError}
          </div>
        )}
        {children(form)}
      </form>
    </Modal>
  );
}
