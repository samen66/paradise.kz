'use client';

import { isAxiosError } from 'axios';
import { useCallback, useEffect, useRef, useState } from 'react';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

type Job = () => Promise<unknown>;

type LaravelError = { message?: string; errors?: Record<string, string[]> };

/** Текст под полем: первое сообщение 422, иначе общий. 5xx и сеть уже показал перехватчик api. */
export function saveErrorMessage(error: unknown): string {
  if (isAxiosError<LaravelError>(error) && error.response?.status === 422) {
    const data = error.response.data;
    const first = data?.errors ? Object.values(data.errors)[0]?.[0] : undefined;
    return first ?? data?.message ?? 'Не сохранено';
  }

  return 'Не сохранено — проверьте сеть и нажмите «Повторить»';
}

const without = (errors: Record<string, string>, key: string): Record<string, string> => {
  if (!(key in errors)) {
    return errors;
  }
  const next = { ...errors };
  delete next[key];
  return next;
};

/**
 * Очередь автосохранения «живого документа».
 *
 * Каждое поле сохраняется под своим ключом (`line:12`, `header:note`).
 * `schedule` откладывает запрос на `delayMs` и заменяет ещё не отправленный
 * запрос того же ключа; `flush` отправляет отложенный сразу (blur); `run` —
 * сразу. Запросы одного ключа идут строго по очереди, так что последним на
 * сервер приходит последний ввод. Ошибка остаётся у ключа до удачного
 * сохранения или `cancel`; `retry` повторяет все упавшие.
 */
export function useAutosave(delayMs = 600) {
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const waiting = useRef(new Map<string, Job>());
  const chains = useRef(new Map<string, Promise<void>>());
  const failed = useRef(new Map<string, Job>());
  const [waitingCount, setWaitingCount] = useState(0);
  const [inFlight, setInFlight] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [savedOnce, setSavedOnce] = useState(false);

  const run = useCallback((key: string, job: Job): Promise<boolean> => {
    setInFlight((n) => n + 1);
    let ok = false;
    const previous = chains.current.get(key) ?? Promise.resolve();
    const next = previous.then(async () => {
      try {
        await job();
        ok = true;
        failed.current.delete(key);
        setErrors((current) => without(current, key));
        setSavedOnce(true);
      } catch (error) {
        failed.current.set(key, job);
        setErrors((current) => ({ ...current, [key]: saveErrorMessage(error) }));
      } finally {
        setInFlight((n) => n - 1);
      }
    });
    chains.current.set(key, next);

    return next.then(() => ok);
  }, []);

  const flush = useCallback(
    (key: string) => {
      const timer = timers.current.get(key);
      if (timer) {
        clearTimeout(timer);
        timers.current.delete(key);
      }
      const job = waiting.current.get(key);
      waiting.current.delete(key);
      setWaitingCount(waiting.current.size);
      if (job) {
        void run(key, job);
      }
    },
    [run],
  );

  const schedule = useCallback(
    (key: string, job: Job) => {
      const timer = timers.current.get(key);
      if (timer) {
        clearTimeout(timer);
      }
      waiting.current.set(key, job);
      setWaitingCount(waiting.current.size);
      timers.current.set(key, setTimeout(() => flush(key), delayMs));
    },
    [delayMs, flush],
  );

  const cancel = useCallback((key: string) => {
    const timer = timers.current.get(key);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(key);
    }
    waiting.current.delete(key);
    failed.current.delete(key);
    setWaitingCount(waiting.current.size);
    setErrors((current) => without(current, key));
  }, []);

  const retry = useCallback(() => {
    for (const [key, job] of [...failed.current]) {
      void run(key, job);
    }
  }, [run]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((timer) => clearTimeout(timer));
  }, []);

  const hasErrors = Object.keys(errors).length > 0;
  const state: SaveState = inFlight > 0 || waitingCount > 0 ? 'saving' : hasErrors ? 'error' : savedOnce ? 'saved' : 'idle';

  return { state, errors, hasUnsaved: inFlight > 0 || waitingCount > 0 || hasErrors, schedule, flush, run, cancel, retry };
}
