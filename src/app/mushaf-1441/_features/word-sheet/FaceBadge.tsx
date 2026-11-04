// "وجه N" badge for a word that shows several faces. The number is text, so it does not rely on colour.
export function FaceBadge({ number }: { number: number }) {
  return (
    <span
      data-testid="face-badge"
      className="rounded border border-[#e3d6b4] bg-[#fbf3dc] px-1.5 py-0.5 text-[11px] font-bold text-[#7a5a10]"
    >
      وجه {number}
    </span>
  )
}
