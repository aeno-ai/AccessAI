// Same job as frontend/src/api/apiClient.ts, adapted for the browser: there's
// no token to attach. The session lives in an httpOnly cookie that this
// code can't read — `credentials: 'include'` just tells the browser to send
// it along.
const BASE_URL = `${import.meta.env.VITE_API_URL ?? ''}/api/admin`;

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

type ErrorBody = {
  message?: string;
  code?: string;
  errors?: { field: string; message: string }[];
};

const unauthorizedListeners = new Set<() => void>();

// Any 401 from any request means the session is gone (expired, logged out
// elsewhere, disabled, role changed) — AuthProvider listens and drops the
// user back to the login page.
export function onUnauthorized(listener: () => void) {
  unauthorizedListeners.add(listener);
  return () => {
    unauthorizedListeners.delete(listener);
  };
}

export async function apiFetch<T = unknown>(endpoint: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
  } catch {
    throw new ApiError('Could not reach the server. Check your connection and try again.', 0);
  }

  const data = (await response.json().catch(() => ({}))) as T & ErrorBody;

  if (!response.ok) {
    if (response.status === 401) {
      unauthorizedListeners.forEach((listener) => listener());
    }
    const message =
      data.errors?.[0]?.message ??
      data.message ??
      (response.status === 429 ? 'Too many requests. Please wait a moment and try again.' : 'Something went wrong');
    throw new ApiError(message, response.status, data.code);
  }

  return data;
}

// A CSV download (HANDOFF.md §52): fetched with the session cookie, then
// handed to the browser as a file with the name the server chose.
export async function apiDownload(endpoint: string): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${endpoint}`, { credentials: 'include' });
  } catch {
    throw new ApiError('Could not reach the server. Check your connection and try again.', 0);
  }
  if (!response.ok) {
    if (response.status === 401) unauthorizedListeners.forEach((listener) => listener());
    const body = (await response.json().catch(() => ({}))) as ErrorBody;
    throw new ApiError(body.errors?.[0]?.message ?? body.message ?? 'The download failed', response.status, body.code);
  }
  const name = /filename="([^"]+)"/.exec(response.headers.get('Content-Disposition') ?? '')?.[1] ?? 'accessai-export.csv';
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong';
}
