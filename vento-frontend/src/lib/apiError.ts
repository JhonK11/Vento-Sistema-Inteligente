import { isAxiosError } from 'axios';

export function apiError(error: unknown, fallback = 'No se pudo completar la operación.'): string {
  if (isAxiosError<{ detail?: string; message?: string }>(error)) {
    return error.response?.data?.detail || error.response?.data?.message || fallback;
  }
  return error instanceof Error ? error.message : fallback;
}
