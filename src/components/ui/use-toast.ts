// Minimal toast shim (replace with shadcn/ui real implementation when available)
type Options = { title?: string; description?: string; variant?: 'default' | 'destructive' };
export function useToast() {
  return {
    toast: (opts: Options) => {
      // You can swap this to a prettier UI or console.info
      if (typeof window !== 'undefined') {
        const parts = [opts.title, opts.description].filter(Boolean).join(' — ');
        if (opts.variant === 'destructive') alert(`⚠️ ${parts}`);
        else alert(parts || 'Notification');
      }
    },
  };
}
