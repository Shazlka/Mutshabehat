import type { Metadata } from 'next'
import MutoonEditor from './MutoonEditor'

export const metadata: Metadata = { title: 'محرر المتون — الشاطبية والدرة والطيبة' }

export default function MutoonEditorPage() {
  return (
    <main lang="ar">
      <MutoonEditor />
    </main>
  )
}
