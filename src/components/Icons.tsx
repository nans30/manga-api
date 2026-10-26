import React from 'react';

interface IconProps {
  active?: boolean;
  className?: string;
}

/**
 * Exact Figma/Flaticon Pentagon Home Icon from reference image
 */
export const NavHomeIcon: React.FC<IconProps> = ({ active, className = 'w-6 h-6' }) => {
  if (active) {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={className}>
        <path
          d="M10.73 2.45a2 2 0 0 1 2.54 0l7 5.73a2 2 0 0 1 .73 1.55v9.27a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9.73a2 2 0 0 1 .73-1.55l7-5.73Z"
          fill="#f9cb55"
        />
        <path
          d="M9 16h6"
          stroke="#121212"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M10.73 2.45a2 2 0 0 1 2.54 0l7 5.73a2 2 0 0 1 .73 1.55v9.27a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9.73a2 2 0 0 1 .73-1.55l7-5.73Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M9 16h6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
};

/**
 * Exact Figma/Flaticon Compass Explore Icon from reference image
 */
export const NavCompassIcon: React.FC<IconProps> = ({ active, className = 'w-6 h-6' }) => {
  if (active) {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={className}>
        <circle cx="12" cy="12" r="9.5" fill="#f9cb55" />
        <polygon points="15.5,8.5 13.2,13.2 8.5,15.5 10.8,10.8" fill="#121212" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <polygon
        points="15.2,8.8 13.3,13.3 8.8,15.2 10.7,10.7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
};

/**
 * Exact Figma/Flaticon Bookmark Ribbon Icon from reference image
 */
export const NavBookmarkIcon: React.FC<IconProps> = ({ active, className = 'w-6 h-6' }) => {
  if (active) {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={className}>
        <path
          d="M6 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16.2a.8.8 0 0 1-1.26.65L12 17.5l-4.74 3.35A.8.8 0 0 1 6 20.2V4Z"
          fill="#f9cb55"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M6 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16.2a.8.8 0 0 1-1.26.65L12 17.5l-4.74 3.35A.8.8 0 0 1 6 20.2V4Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
};

/**
 * Exact Figma/Flaticon User Profile Icon from reference image
 */
export const NavUserIcon: React.FC<IconProps> = ({ active, className = 'w-6 h-6' }) => {
  if (active) {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={className}>
        <circle cx="12" cy="8" r="4" fill="#f9cb55" />
        <path
          d="M5 19.5C5 16.46 8.13 14 12 14s7 2.46 7 5.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19.5Z"
          fill="#f9cb55"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="8" r="3.8" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M5.5 19.5C5.5 16.5 8.4 14.2 12 14.2s6.5 2.3 6.5 5.3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
};

/**
 * Shopping Bag / Reading Bag Icon in Top Header
 */
export const HeaderBagIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className}>
    <path
      d="M5.5 8h13l1 12.5a1.5 1.5 0 0 1-1.5 1.5H6a1.5 1.5 0 0 1-1.5-1.5L5.5 8Z"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
    <path
      d="M8.5 8V6.5a3.5 3.5 0 0 1 7 0V8"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
);

/**
 * Comic Starburst SVG Shape for "READ NOW ->" Button (Screen 3 of reference)
 */
export const ComicStarburstButton: React.FC<{
  onClick?: () => void;
  label?: string;
  className?: string;
}> = ({ onClick, label = 'READ NOW', className = '' }) => (
  <button
    onClick={onClick}
    className={`group relative inline-flex items-center justify-center w-64 h-20 select-none transition-transform duration-200 hover:scale-105 active:scale-95 ${className}`}
  >
    <svg
      viewBox="0 0 300 96"
      fill="none"
      className="absolute inset-0 w-full h-full drop-shadow-[0_6px_20px_rgba(249,203,85,0.3)]"
      preserveAspectRatio="none"
    >
      <polygon
        points="150,2 178,16 218,4 226,22 272,14 256,34 298,42 266,56 292,72 246,74 256,92 206,82 186,95 150,82 114,95 94,82 44,92 54,74 8,72 34,56 2,42 44,34 28,14 74,22 82,4 122,16"
        fill="#f9cb55"
      />
    </svg>
    <span className="relative z-10 font-manga text-[#121212] text-xl tracking-wider flex items-center gap-2">
      {label}
      <span className="text-xl transition-transform group-hover:translate-x-1">→</span>
    </span>
  </button>
);
