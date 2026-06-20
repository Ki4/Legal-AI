// Pure helpers for the "example document" upload in service-mirror slice 3 (#66).
// Kept I/O-free so the size/type rules and the storage-key shape are unit-tested
// independently of Supabase Storage (which also enforces them on the bucket).

/** Hard cap, mirrors the bucket's `file_size_limit` in migration 026. */
export const MAX_EXAMPLE_BYTES = 10 * 1024 * 1024 // 10 MB

/** Accepted MIME types, mirrors the bucket's `allowed_mime_types`. */
export const ALLOWED_EXAMPLE_MIME = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const

const ALLOWED_EXT = ['pdf', 'doc', 'docx'] as const

interface FileLike {
  name: string
  size: number
  type: string
}

function ext(name: string): string {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i + 1).toLowerCase() : ''
}

/**
 * Validate a chosen example file. Returns a Ukrainian error message, or `null` if ok.
 * Some browsers leave `type` empty for .docx — fall back to the extension.
 */
export function validateExampleFile(file: FileLike): string | null {
  if (file.size === 0) return 'Файл порожній.'
  if (file.size > MAX_EXAMPLE_BYTES) return 'Файл завеликий (максимум 10 МБ).'
  const okMime = (ALLOWED_EXAMPLE_MIME as readonly string[]).includes(file.type)
  const okExt = (ALLOWED_EXT as readonly string[]).includes(ext(file.name))
  if (!okMime && !okExt) return 'Лише PDF або DOC/DOCX.'
  return null
}

/**
 * Build a collision-free, storage-safe object key for the upload.
 * Cyrillic / spaces / punctuation in the original name are stripped to `_` so the
 * key is portable; the (unique) id keeps two uploads of "позов.docx" apart.
 */
export function buildExamplePath(filename: string, uniqueId: string): string {
  const e = ext(filename)
  const base = filename
    .slice(0, e ? filename.length - e.length - 1 : filename.length)
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40) || 'file'
  return `requests/${uniqueId}_${base}${e ? '.' + e : ''}`
}
