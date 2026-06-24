// Square icon button (Claude Design canvas). `bare` = borderless (e.g. card footers).
import type { ButtonHTMLAttributes } from 'react'

export function IconButton({
  bare = false,
  className = '',
  ...rest
}: { bare?: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  const base = bare
    ? 'w-8 h-8 bg-transparent text-inkMute hover:bg-paperAlt hover:text-ink'
    : 'w-9 h-9 bg-paper text-inkSoft border border-lineStrong hover:bg-paperAlt hover:text-ink'
  return (
    <button
      className={`inline-flex items-center justify-center rounded-[9px] transition-colors ${base} ${className}`}
      {...rest}
    />
  )
}
