import { isAxiosError } from 'axios';
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';

type LaravelError = { message?: string; errors?: Record<string, string[]> };

/**
 * Puts a Laravel 422 onto the form fields. Laravel's dot keys (`name.ru`)
 * are the same paths react-hook-form uses. Returns a message to show above
 * the form when the 422 is a business rule rather than a field error;
 * 401/403/5xx are already reported by the axios interceptor.
 */
export function applyServerErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
): string | null {
  if (!isAxiosError<LaravelError>(error) || error.response?.status !== 422) {
    return isAxiosError(error) ? null : 'Неизвестная ошибка';
  }

  const { errors, message } = error.response.data ?? {};

  if (!errors) {
    return message ?? 'Операция отклонена';
  }

  for (const [field, messages] of Object.entries(errors)) {
    setError(field as Path<T>, { type: 'server', message: messages[0] });
  }

  return null;
}

/** The server's explanation of a refused action (422), if any. */
export function serverMessage(error: unknown): string | null {
  if (isAxiosError<LaravelError>(error) && error.response?.status === 422) {
    return error.response.data?.message ?? 'Операция отклонена';
  }

  return null;
}
