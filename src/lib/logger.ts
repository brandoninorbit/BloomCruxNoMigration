export type LogContext = {
  reqId?: string;
  userId?: string;
  deckId?: number;
  bloom?: string;
  attemptId?: number;
};

function nowIso() {
  return new Date().toISOString();
}

function safeStringify(obj: unknown) {
  try {
    return JSON.stringify(obj);
  } catch {
    return String(obj);
  }
}

export function log(level: 'info' | 'warn' | 'error', op: string, details?: unknown, ctx?: LogContext) {
  const out = {
    ts: nowIso(),
    level,
    op,
    context: ctx ?? {},
    details: details ?? null,
  } as const;
  const s = safeStringify(out);
  if (level === 'error') console.error(s);
  else if (level === 'warn') console.warn(s);
  else console.log(s);
}

export const info = (op: string, details?: unknown, ctx?: LogContext) => log('info', op, details, ctx);
export const warn = (op: string, details?: unknown, ctx?: LogContext) => log('warn', op, details, ctx);
export const error = (op: string, details?: unknown, ctx?: LogContext) => log('error', op, details, ctx);

export function makeReqId(prefix = 'req') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
}
