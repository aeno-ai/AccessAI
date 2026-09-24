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

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong';
}
