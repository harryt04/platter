import type { SVGProps } from 'react'

export function PlatterMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 512 512" role="img" aria-label="Platter" {...props}>
      <rect width="512" height="512" rx="104" fill="#0057D9" />
      <path
        d="M137 222h238l-24 151a46 46 0 0 1-45 38H206a46 46 0 0 1-45-38l-24-151Z"
        fill="#FFFFFF"
      />
      <path
        d="M186 224c7-68 33-103 70-103s63 35 70 103"
        fill="none"
        stroke="#FFFFFF"
        strokeLinecap="round"
        strokeWidth="31"
      />
      <path
        d="m190 307 40 40 91-94"
        fill="none"
        stroke="#0057D9"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="31"
      />
      <path
        d="M335 148c30-20 55-15 65-6-6 25-27 48-63 45-12-1-23-5-31-11 7-10 16-19 29-28Z"
        fill="#F6A700"
      />
    </svg>
  )
}
