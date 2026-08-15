// codeseek mark. Keeps the FishLogo export so sidebar / hero call sites stay unchanged.
import type { IconProps } from './icons/props.ts'

/**
 * Render the codeseek compass-C mark.
 * @param props.size - width in px (default 24; height matches for a square mark).
 * @param props.className - extra class for layout placement.
 * @returns the logo svg (aria-hidden; pair with the wordmark for accessibility).
 */
export function FishLogo({ size = 24, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M19.6 12a7.6 7.6 0 1 1-3.05-6.07"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M18.55 4.55l.55 1.26 1.36.16-1.03.9.34 1.35-1.22-.73-1.22.73.34-1.35-1.03-.9 1.36-.16z"
        fill="#F5C16C"
      />
    </svg>
  )
}
