import { getToken } from '@/utils/tokenStorage';
import { emitUnauthorized } from '@/utils/authEvents';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

type ApiErrorBody = {
  message?: string;
};

export async function apiFetch<T = unknown>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const data = (await response.json()) as T & ApiErrorBody;

  if (!response.ok) {
    if (response.status === 401) {
      emitUnauthorized();
    }
    throw new Error(data.message || 'Something went wrong');
  }

  return data;
}
