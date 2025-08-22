// Deterministic, tree-shakeable deck color mapper.
// HSL chosen for good contrast on light/dark themes.
export function deckColor(deckId: string) {
  let h = 0;
  for (let i = 0; i < deckId.length; i++) h = (h * 31 + deckId.charCodeAt(i)) % 360;
  return `hsl(${h}, 65%, 45%)`;
}
