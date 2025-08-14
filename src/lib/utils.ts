// Minimal utils used by shadcn-style components. No external deps.
export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}
