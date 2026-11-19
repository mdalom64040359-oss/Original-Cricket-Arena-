import React from 'react';

interface CricketLogoProps {
  size?: number;
  className?: string;
}

export const CricketLogo: React.FC<CricketLogoProps> = ({size = 32, className = ''}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect width="64" height="64" rx="14" fill="#0B3B24" />
      <rect
        x="2.5"
        y="2.5"
        width="59"
        height="59"
        rx="12"
        stroke="#22C55E"
        strokeOpacity="0.35"
        strokeWidth="1.5"
      />
      <path
        d="M32 10L50 17.5V33C50 44.5 42 53 32 56.5C22 53 14 44.5 14 33V17.5L32 10Z"
        fill="#070E0A"
        stroke="#FFFFFF"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <rect x="25" y="21" width="2.5" height="22" rx="1.25" fill="#FFFFFF" />
      <rect x="30.75" y="21" width="2.5" height="22" rx="1.25" fill="#FFFFFF" />
      <rect x="36.5" y="21" width="2.5" height="22" rx="1.25" fill="#FFFFFF" />
      <rect x="24.5" y="18.5" width="6.5" height="2" rx="1" fill="#22C55E" />
      <rect x="33" y="18.5" width="6.5" height="2" rx="1" fill="#22C55E" />
      <circle cx="40.5" cy="39" r="5.5" fill="#16A34A" stroke="#070E0A" strokeWidth="1.5" />
    </svg>
  );
};
