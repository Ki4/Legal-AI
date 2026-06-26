// Pure helpers for the document preview: map doc-engine {{!style: …}} hints to
// CSS classes and split rendered text into styled paragraphs.
// Kept engine-free so it is unit-testable without the '@doc-engine' alias.

/** A rendered paragraph: its text + the CSS classes derived from style hints. */
export interface PreviewParagraph {
  text: string
  className: string
}

/** Map doc-engine {{!style: …}} keywords to Tailwind classes for on-screen preview.
 *  Print-layout-only hints (keep-with-next / keep-together / page-break) have no
 *  visual effect here and are intentionally ignored. */
export function styleClasses(keywords: string[] | undefined): string {
  if (!keywords || keywords.length === 0) return ''
  const out: string[] = []
  for (const k of keywords) {
    switch (k) {
      case 'center': out.push('text-center'); break
      case 'right': out.push('text-right'); break
      case 'bold': out.push('font-semibold'); break
      case 'italic': out.push('italic'); break
      case 'indent': out.push('indent-8'); break
      default: break
    }
  }
  return out.join(' ')
}

/** Split rendered text into paragraphs and attach each paragraph's style classes. */
export function toParagraphs(text: string, styleHints: Record<number, string[]>): PreviewParagraph[] {
  return text.split('\n').map((line, i) => ({ text: line, className: styleClasses(styleHints[i]) }))
}
