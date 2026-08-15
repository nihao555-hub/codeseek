// codeseek wordmark: compass-C + "codeseek" + SUPER badge. Keeps BrandWordmark export.
import type { IconProps } from './icons/props.ts'

/**
 * Render the codeseek brand wordmark.
 * @param props.size - height in px (default 24; width keeps the 188:24 ratio).
 * @param props.className - extra class for layout placement.
 * @returns the wordmark svg (aria-hidden decorative brand art).
 */
export function BrandWordmark({ size = 24, className }: IconProps) {
  return (
    <svg
      width={(size * 188) / 24}
      height={size}
      className={className}
      viewBox="0 0 188 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M19.4 12.2a7.4 7.4 0 1 1-2.97-5.91"
        stroke="currentColor"
        strokeWidth="2.3"
        strokeLinecap="round"
      />
      <path
        d="M18.35 4.85l.5 1.16 1.26.15-.95.83.31 1.24-1.13-.67-1.13.67.31-1.24-.95-.83 1.26-.15z"
        fill="#F5C16C"
      />
      <text
        x="28"
        y="16.5"
        fill="currentColor"
        fontFamily="ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif"
        fontSize="13.5"
        fontWeight="600"
        letterSpacing="0.04em"
      >
        codeseek
      </text>
      <rect x="132" y="5" width="50" height="14" rx="2" fill="currentColor" />
      <text
        x="157"
        y="15.2"
        textAnchor="middle"
        fill="var(--dsw-alias-label-primary-inverted, #fff)"
        fontFamily="ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif"
        fontSize="8.5"
        fontWeight="700"
        letterSpacing="0.14em"
      >
        SUPER
      </text>
    </svg>
  )
}
