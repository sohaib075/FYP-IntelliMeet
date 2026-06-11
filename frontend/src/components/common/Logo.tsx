import React from 'react'

interface LogoProps extends React.SVGProps<SVGSVGElement> {
  iconOnly?: boolean
  showText?: boolean
  size?: number
}

export function Logo({ iconOnly = false, showText = true, size = 36, className, ...props }: LogoProps) {
  // Height is set to size. Width is size * 3 (based on 240:80 aspect ratio)
  const height = size
  const width = size * 3

  if (iconOnly) {
    return (
      <svg
        viewBox="0 0 80 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        style={{ width: size, height: size }}
        {...props}
      >
        <path
          d="M 57.5 18.3 A 25 25 0 1 1 57.5 61.7"
          stroke="currentColor"
          strokeWidth="5.5"
          strokeLinecap="round"
        />
        <text
          x="15"
          y="49"
          fontFamily="'Sora', 'Outfit', 'Inter', sans-serif"
          fontWeight="800"
          fontSize="24"
          fill="currentColor"
          letterSpacing="-0.5"
        >
          IM
        </text>
      </svg>
    )
  }

  return (
    <svg
      viewBox="0 0 240 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`text-black dark:text-white ${className || ''}`}
      style={{ height, width, display: 'inline-block', verticalAlign: 'middle' }}
      {...props}
    >
      {showText && (
        <text
          x="10"
          y="50"
          fontFamily="'Sora', 'Outfit', 'Inter', sans-serif"
          fontWeight="700"
          fontSize="28"
          fill="currentColor"
          letterSpacing="-0.5"
        >
          IntelliMeet
        </text>
      )}
      {/* 
        Official intersecting circle wrapping the "Meet" part.
        Center is at cx=158, cy=40, radius=34.
        The circle is broken on the left so it wraps the word "Meet" without overlapping letters.
        Starting top-left (245 degrees) and looping clockwise to bottom-left (115 degrees).
      */}
      <path
        d="M 143.7 9.2 A 34 34 0 1 1 143.7 70.8"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  )
}


