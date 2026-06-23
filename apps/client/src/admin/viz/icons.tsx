// Lucide icon map for node kinds (matches the icon set used in the design canvas).
import { Landmark, FileText, Briefcase, FileCheck2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { NodeKind } from './theme'

export const KIND_ICON: Record<NodeKind, LucideIcon> = {
  law: Landmark,
  art: FileText,
  srv: Briefcase,
  doc: FileCheck2,
}
