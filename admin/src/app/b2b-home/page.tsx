'use client';

import { useCallback, useEffect, useState } from 'react';
import { z } from 'zod';
import api from '@/lib/api';
import { translatable, translatableText } from '@/lib/validation';
import CrudModal from '@/components/ui/CrudModal';
import PageHeader from '@/components/ui/PageHeader';
import SingleImageUpload from '@/components/ui/SingleImageUpload';
import TranslatableField from '@/components/ui/TranslatableField';
import { buttonSecondary, cardClass } from '@/components/ui/styles';

type Content = {
  about_title: { ru?: string; kk?: string };
  about_text: { ru?: string; kk?: string };
  image_url: string | null;
};

const schema = z.object({ about_title: translatable, about_text: translatableText });

export default function B2bHomePage() {
  const [content, setContent] = useState<Content | null>(null);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    const res = await api.get<{ data: Content }>('/admin/b2b-home');
    setContent(res.data.data);
  }, []);

  useEffect(() => {
    // Fetch-on-mount: load() synchronizes with the API, an external system.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  if (!content) {
    return <div className="text-zinc-500">Загрузка…</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="B2B-главная"
        actions={<button type="button" className={buttonSecondary} onClick={() => setEditing(true)}>Изменить текст</button>}
      />
      <p className="text-sm text-zinc-500">
        Блок «Кто мы» на b2b.paradise.kz. Баннеры — в разделе «Баннеры» (место «B2B-главная»),
        стили — это подборки с флажком «На B2B-главной».
      </p>
      <section className={`${cardClass} space-y-4 p-6`}>
        <h2 className="text-lg font-semibold text-zinc-900">{content.about_title.ru || 'Заголовок не задан'}</h2>
        <p className="whitespace-pre-line text-sm text-zinc-700">{content.about_text.ru || 'Текст не задан'}</p>
        <SingleImageUpload
          path="/admin/b2b-home/image"
          imageUrl={content.image_url}
          label="Фото шоурума"
          hint="От 1600×1200"
          onChange={load}
        />
      </section>

      {editing && (
        <CrudModal
          title="Блок «Кто мы»"
          schema={schema}
          defaultValues={{
            about_title: { ru: content.about_title.ru ?? '', kk: content.about_title.kk ?? '' },
            about_text: { ru: content.about_text.ru ?? '', kk: content.about_text.kk ?? '' },
          }}
          onSubmit={async (values) => {
            await api.put('/admin/b2b-home', values);
            await load();
          }}
          onClose={() => setEditing(false)}
        >
          {(form) => (
            <>
              <TranslatableField form={form} name="about_title" label="Заголовок" required />
              <TranslatableField form={form} name="about_text" label="Текст" required multiline />
            </>
          )}
        </CrudModal>
      )}
    </div>
  );
}
