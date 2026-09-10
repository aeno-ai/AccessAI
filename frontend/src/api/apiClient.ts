const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

type ApiErrorBody = {
  message?: string;
};

export async function apiFetch<T = unknown>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const data = (await response.json()) as T & ApiErrorBody;

  if (!response.ok) {
    throw new Error(data.message || 'Something went wrong');
  }

  return data;
}
