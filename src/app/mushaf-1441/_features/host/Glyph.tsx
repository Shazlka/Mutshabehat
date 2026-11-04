// A decorative symbol (✓ ⚑ ⇄ ★ ‹ ›): hidden from screen readers, which would otherwise read its character name.
export function Glyph({ children }: { children: string }) {
  return <span aria-hidden="true">{children}</span>
}
