
'use client';
import { ReactNode, useRef } from 'react';

export type Toast = { id: string; title?: string; description?: string; action?: ReactNode };

export function useToast() {
  const toastsRef = useRef<Toast[]>([]);
  const toast = () => { /* no-op stub */ };
  return { toast, toasts: toastsRef.current };
}
