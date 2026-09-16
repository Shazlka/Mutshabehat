'use client'

import { useState } from 'react'
import { QIRAAT_READERS } from '../../../../../packages/qiraat-core/readers'
import { narratorsOfReader } from '../../../../../packages/qiraat-core/narrators'
import { readerColor, narratorColor } from '../../../../../packages/qiraat-core/colors'

// Part 14: the ten readers, each an expandable accordion of its two narrators. Color is shown
// as a swatch AND the name is always printed — never color alone (Part 20 accessibility).
export default function QiraatLegend() {
  const [openReaderId, setOpenReaderId] = useState<string | null>(null)

  return (
    <div className="space-y-1.5">
      {QIRAAT_READERS.map((reader) => {
        const isOpen = openReaderId === reader.id
        const narrators = narratorsOfReader(reader.id)
        return (
          <div key={reader.id} className="overflow-hidden rounded-md border border-[#d7c7a7]">
            <button
              type="button"
              onClick={() => setOpenReaderId(isOpen ? null : reader.id)}
              className="flex w-full items-center justify-between gap-3 bg-[#fffaf0] px-3 py-2 text-sm"
            >
              <span className="flex items-center gap-2 font-bold text-[#171717]">
                <span aria-hidden className="inline-block size-3 rounded-full" style={{ backgroundColor: readerColor(reader.id) }} />
                {reader.nameAr}
              </span>
              <span aria-hidden className="text-xs text-[#80662c]">{isOpen ? '▲' : '▼'}</span>
            </button>
            {isOpen ? (
              <div className="space-y-1 bg-white px-3 py-2">
                <p className="flex items-center gap-2 text-xs text-[#665b48]">
                  <span aria-hidden className="inline-block size-2.5 rounded-full" style={{ backgroundColor: readerColor(reader.id) }} />
                  جميع روايات {reader.nameAr}
                </p>
                {narrators.map((narrator) => (
                  <p key={narrator.id} className="flex items-center gap-2 text-xs text-[#3a3326]">
                    <span aria-hidden className="inline-block size-2.5 rounded-full" style={{ backgroundColor: narratorColor(narrator.id) }} />
                    {narrator.nameAr}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
