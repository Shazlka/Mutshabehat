import type { AuthorityPill } from '../../../../../packages/qiraat-core/attribution'

/** Reader / narrator pills in their identity colour, always with the name as text. */
export function AuthorityPills({ pills }: { pills: AuthorityPill[] }) {
  return (
    <span className="flex flex-wrap gap-1">
      {pills.map((pill) => (
        <span key={pill.key} className="rounded-full px-2 py-0.5 text-[11px] font-bold text-white" style={{ background: pill.color }}>
          {pill.name}
        </span>
      ))}
    </span>
  )
}
