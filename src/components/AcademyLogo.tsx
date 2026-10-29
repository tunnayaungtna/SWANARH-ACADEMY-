import React, { useState } from 'react';
import { OFFICIAL_ACADEMY_LOGO } from '../assets/officialLogoData';

interface AcademyLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const AcademyLogo: React.FC<AcademyLogoProps> = ({
  className = '',
  size = 'lg',
}) => {
  const [imgError, setImgError] = useState(false);

  const dimensions = {
    sm: 'w-10 h-10',
    md: 'w-16 h-16',
    lg: 'w-28 h-28 sm:w-32 sm:h-32',
    xl: 'w-40 h-40 sm:w-48 sm:h-48',
  }[size];

  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-full bg-white shadow-md overflow-hidden shrink-0 select-none ${dimensions} ${className}`}
      title="SwanArh Classroom · Dr. Si Thu Aung · Swanarh Academy"
    >
      {!imgError ? (
        <img
          src={OFFICIAL_ACADEMY_LOGO}
          alt="Dr. Si Thu Aung · Swanarh Academy"
          onError={() => setImgError(true)}
          className="w-full h-full object-contain p-0.5 rounded-full bg-white"
        />
      ) : (
        <svg
          viewBox="0 0 400 400"
          className="w-full h-full"
          xmlns="http://www.w3.org/2000/svg"
        >
        <defs>
          {/* Top arc for DR. SI THU AUNG - centered in the outer white band */}
          <path
            id="topAcademyArc"
            d="M 55,205 A 145,145 0 1,1 345,205"
            fill="none"
          />
          {/* Bottom arc for SWANARH ACADEMY - centered in the lower white band */}
          <path
            id="bottomAcademyArc"
            d="M 32,205 A 168,168 0 0,0 368,205"
            fill="none"
          />
          <linearGradient id="academyGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F6C653" />
            <stop offset="50%" stopColor="#EBA534" />
            <stop offset="100%" stopColor="#D68522" />
          </linearGradient>
        </defs>

        {/* Crisp White Circular Background with Outer Black Ring */}
        <circle
          cx="200"
          cy="200"
          r="193"
          fill="#FFFFFF"
          stroke="#0A0A0A"
          strokeWidth="4.5"
        />

        {/* Inner Black Circle Ring */}
        <circle
          cx="200"
          cy="200"
          r="124"
          fill="#FFFFFF"
          stroke="#0A0A0A"
          strokeWidth="3.2"
        />

        {/* Top Curved Text: DR. SI THU AUNG */}
        <text
          fill="#E31E24"
          fontSize="38"
          fontWeight="900"
          fontFamily="Georgia, 'Times New Roman', Times, serif"
          letterSpacing="2.5"
        >
          <textPath
            href="#topAcademyArc"
            startOffset="50%"
            textAnchor="middle"
          >
            DR. SI THU AUNG
          </textPath>
        </text>

        {/* Bottom Curved Text: SWANARH ACADEMY */}
        <text
          fill="#158E26"
          fontSize="24.5"
          fontWeight="800"
          fontFamily="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
          letterSpacing="3"
        >
          <textPath
            href="#bottomAcademyArc"
            startOffset="50%"
            textAnchor="middle"
          >
            SWANARH ACADEMY
          </textPath>
        </text>

        {/* Left & Right 4-Pointed Gold Stars in the Ring */}
        <g fill="url(#academyGoldGrad)">
          {/* Left Star */}
          <path d="M 46,204 L 51.5,217.5 L 65,223 L 51.5,228.5 L 46,242 L 40.5,228.5 L 27,223 L 40.5,217.5 Z" />
          {/* Right Star */}
          <path d="M 354,204 L 359.5,217.5 L 373,223 L 359.5,228.5 L 354,242 L 348.5,228.5 L 335,223 L 348.5,217.5 Z" />
        </g>

        {/* Center Shield Crest inside the inner circle */}
        <g transform="translate(0, -6)">
          {/* Outer Green Shield Frame */}
          <path
            d="M 200,104 L 258,125 L 258,190 C 258,228 200,258 200,258 C 200,258 142,228 142,190 L 142,125 Z"
            fill="#FFFFFF"
            stroke="#148823"
            strokeWidth="6.5"
            strokeLinejoin="round"
          />

          {/* Top-Left Quadrant (Green) */}
          <path
            d="M 197,111 L 149,129 L 149,184 L 197,184 Z"
            fill="#148823"
          />

          {/* Top-Right Quadrant (Red) */}
          <path
            d="M 203,111 L 251,129 L 251,184 L 203,184 Z"
            fill="#E31E24"
          />

          {/* Bottom-Left Quadrant (Red) */}
          <path
            d="M 149,190 L 197,190 L 197,248 C 179,238 149,217 149,192 Z"
            fill="#E31E24"
          />

          {/* Bottom-Right Quadrant (Green) */}
          <path
            d="M 203,190 L 251,190 L 251,192 C 251,217 221,238 203,248 Z"
            fill="#148823"
          />

          {/* White Quadrant Divider Cross */}
          <line x1="200" y1="109" x2="200" y2="251" stroke="#FFFFFF" strokeWidth="5" />
          <line x1="147" y1="187" x2="253" y2="187" stroke="#FFFFFF" strokeWidth="5" />

          {/* Quadrant 1 Icon: White Graduation Cap (Top-Left) */}
          <g fill="#FFFFFF" transform="translate(154, 143)">
            <polygon points="18,3 36,10 18,17 0,10" />
            <path d="M 7.5,13.5 L 7.5,21.5 C 7.5,24.5 28.5,24.5 28.5,21.5 L 28.5,13.5 L 18,18 Z" />
            <line x1="4.5" y1="11.5" x2="4.5" y2="23.5" stroke="#FFFFFF" strokeWidth="1.8" />
            <circle cx="4.5" cy="23.5" r="1.8" />
          </g>

          {/* Quadrant 2 Icon: White Open Book (Top-Right) */}
          <g fill="#FFFFFF" transform="translate(209, 143)">
            <path d="M 2,5 C 8,3 13.5,4 16.5,7 L 16.5,25 C 13.5,22 8,21 2,23 Z" />
            <path d="M 32,5 C 26,3 20.5,4 17.5,7 L 17.5,25 C 20.5,22 26,21 32,23 Z" />
            <path d="M 2,25 C 8,23 13.5,24 17,27 C 20.5,24 26,23 32,25" fill="none" stroke="#FFFFFF" strokeWidth="1.5" />
          </g>

          {/* Quadrant 3 Icon: White Microscope (Bottom-Left) */}
          <g fill="#FFFFFF" transform="translate(163, 196)">
            <rect x="5" y="27" width="20" height="3.5" rx="1" />
            <path d="M 17.5,6 L 22.5,8.5 L 14.5,20.5 L 9.5,18 Z" />
            <path d="M 18.5,12.5 C 24.5,14.5 25.5,22 20.5,27 L 17,27 C 21,23 21,16.5 16.5,14.5 Z" />
            <rect x="8" y="21.5" width="10.5" height="2.2" />
          </g>

          {/* Quadrant 4 Icon: White Globe (Bottom-Right) */}
          <g transform="translate(209, 196)">
            <circle cx="15" cy="13" r="10" fill="#FFFFFF" />
            <path
              d="M 10,7 C 13,9 14,13 11,17 C 9,19 7,17 7,13 Z M 17,6 C 20,8 22,12 20,17 C 18,19 16,16 16,12 Z"
              fill="#148823"
            />
            <path
              d="M 15,23 L 15,28 M 9.5,28 L 20.5,28"
              stroke="#FFFFFF"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
          </g>
        </g>

        {/* Golden Laurel Wreath Branches inside the inner circle */}
        <g fill="url(#academyGoldGrad)">
          {/* Left Branch Stem */}
          <path
            d="M 212,280 C 164,265 129,224 117,165"
            fill="none"
            stroke="url(#academyGoldGrad)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          {/* Right Branch Stem */}
          <path
            d="M 188,280 C 236,265 271,224 283,165"
            fill="none"
            stroke="url(#academyGoldGrad)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* Left Laurel Leaves */}
          <ellipse cx="117" cy="170" rx="4" ry="9.5" transform="rotate(-25 117 170)" />
          <ellipse cx="114" cy="188" rx="4" ry="9.5" transform="rotate(-40 114 188)" />
          <ellipse cx="128" cy="182" rx="4" ry="9.5" transform="rotate(15 128 182)" />
          <ellipse cx="121" cy="206" rx="4.5" ry="10" transform="rotate(-45 121 206)" />
          <ellipse cx="135" cy="200" rx="4" ry="9.5" transform="rotate(20 135 200)" />
          <ellipse cx="131" cy="224" rx="4.5" ry="10" transform="rotate(-50 131 224)" />
          <ellipse cx="145" cy="217" rx="4" ry="9.5" transform="rotate(25 145 217)" />
          <ellipse cx="144" cy="241" rx="4.5" ry="10" transform="rotate(-55 144 241)" />
          <ellipse cx="157" cy="233" rx="4" ry="9.5" transform="rotate(30 157 233)" />
          <ellipse cx="161" cy="256" rx="4.5" ry="10" transform="rotate(-60 161 256)" />
          <ellipse cx="172" cy="246" rx="4" ry="9.5" transform="rotate(35 172 246)" />
          <ellipse cx="181" cy="267" rx="4.5" ry="9.5" transform="rotate(-68 181 267)" />

          {/* Right Laurel Leaves */}
          <ellipse cx="283" cy="170" rx="4" ry="9.5" transform="rotate(25 283 170)" />
          <ellipse cx="286" cy="188" rx="4" ry="9.5" transform="rotate(40 286 188)" />
          <ellipse cx="272" cy="182" rx="4" ry="9.5" transform="rotate(-15 272 182)" />
          <ellipse cx="279" cy="206" rx="4.5" ry="10" transform="rotate(45 279 206)" />
          <ellipse cx="265" cy="200" rx="4" ry="9.5" transform="rotate(-20 265 200)" />
          <ellipse cx="269" cy="224" rx="4.5" ry="10" transform="rotate(50 269 224)" />
          <ellipse cx="255" cy="217" rx="4" ry="9.5" transform="rotate(-25 255 217)" />
          <ellipse cx="256" cy="241" rx="4.5" ry="10" transform="rotate(55 256 241)" />
          <ellipse cx="243" cy="233" rx="4" ry="9.5" transform="rotate(-30 243 233)" />
          <ellipse cx="239" cy="256" rx="4.5" ry="10" transform="rotate(60 239 256)" />
          <ellipse cx="228" cy="246" rx="4" ry="9.5" transform="rotate(-35 228 246)" />
          <ellipse cx="219" cy="267" rx="4.5" ry="9.5" transform="rotate(68 219 267)" />
        </g>
        </svg>
      )}
    </div>
  );
};
