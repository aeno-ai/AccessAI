import { getToken } from '@/utils/tokenStorage';
import { emitUnauthorized } from '@/utils/authEvents';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

/** Full URL of an API endpoint, for pages opened in a browser rather than fetched. */
export function apiUrl(endpoint: string): string {
  return `${BASE_URL}${endpoint}`;
}

type ApiErrorBody = {
  message?: string;
  code?: string;
  [key: string]: unknown;
};

/**
 * What apiFetch throws for any non-2xx response. Still a plain Error with
 * a message ready to show, so `catch (e) { e.message }` keeps working
 * everywhere; `status` and `body` are there for callers that need more —
 * e.g. login telling "wrong password" apart from "account pending
 * deletion". Built with Object.assign rather than `class extends Error`,
 * which doesn't reliably survive `instanceof` after transpiling.
 */
export type ApiError = Error & { status: number; body: ApiErrorBody };

export function isApiError(error: unknown): error is ApiError {
  return error instanceof Error && error.name === 'ApiError';
}

/** No answer at all: no internet, server off, or too slow. Not an ApiError. */
export function isNetworkError(error: unknown): boolean {
  return error instanceof Error && error.name === 'NetworkError';
}

/**
 * The AccessAI server couldn't be reached — no answer at all, or a gateway
 * in between (like the Cloudflare tunnel) saying the server is down. For
 * fallbacks like SOS texting, both mean "treat it as offline".
 */
export function isUnreachable(error: unknown): boolean {
  return !isApiError(error) || [502, 503, 504].includes(error.status);
}

const MESSAGES = {
  network: "Can't reach AccessAI. Check your internet and try again.",
  unreachable: "AccessAI's server isn't reachable right now. Please try again in a moment.",
  tooMany: 'Too many tries. Please wait a moment and try again.',
  server: 'Something went wrong on our side. Please try again.',
  generic: 'Something went wrong. Please try again.',
};

/**
 * What to show for a failed request. Only the server's own JSON `message`
 * is ever shown — never raw response text, which could be an HTML error
 * page from a proxy or a stack trace.
 */
function friendlyMessage(status: number, data: ApiErrorBody | null): string {
  if ([502, 503, 504].includes(status) && !data?.code) return MESSAGES.unreachable;
  const message = data?.message;
  if (typeof message === 'string' && message.trim() && message.length <= 300) return message;
  if (status === 429) return MESSAGES.tooMany;
  if (status >= 500) return MESSAGES.server;
  return MESSAGES.generic;
}

export type ApiOptions = RequestInit & {
  /** Give up after this long and treat it as no connection (default 15 s). */
  timeoutMs?: number;
};

export async function apiFetch<T = unknown>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const { timeoutMs = 15000, ...init } = options;
  const token = await getToken();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${endpoint}`, {
      ...init,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
  } catch {
    // No answer at all (offline, server off, or timed out). Deliberately NOT
    // an ApiError — callers like utils/sos.ts and the chat outbox read
    // "not an ApiError" as "offline" and fall back accordingly.
    throw Object.assign(new Error(MESSAGES.network), { name: 'NetworkError' });
  } finally {
    clearTimeout(timer);
  }

  let data: (T & ApiErrorBody) | null = null;
  if ((response.headers.get('content-type') ?? '').includes('json')) {
    data = (await response.json().catch(() => null)) as (T & ApiErrorBody) | null;
  }

  if (!response.ok) {
    if (response.status === 401) {
      emitUnauthorized();
    }
    throw Object.assign(new Error(friendlyMessage(response.status, data)), {
      name: 'ApiError',
      status: response.status,
      body: (data ?? {}) as ApiErrorBody,
    });
  }

  return (data ?? {}) as T;
}
