// SVG accessories for Pip. Coordinates match PetFigure's 200×200 body space.

export function Hat({ id }: { id?: string }) {
  switch (id) {
    case 'cap': return (
      <g className="wear-hat">
        <path d="M58 92 Q60 56 100 54 Q140 56 142 92 Z" fill="#3a7bd5" />
        <path d="M100 54 Q86 70 84 90 M100 54 Q114 70 116 90" stroke="#2c62ad" strokeWidth="2" fill="none" />
        <path d="M58 90 Q40 90 26 98 Q42 104 64 96 Z" fill="#2c62ad" />
        <circle cx="100" cy="55" r="4" fill="#2c62ad" />
      </g>
    )
    case 'beanie': return (
      <g className="wear-hat">
        <path d="M56 94 Q56 46 100 44 Q144 46 144 94 Z" fill="#e8615a" />
        <path d="M70 60 L70 88 M85 50 L85 88 M100 46 L100 88 M115 50 L115 88 M130 60 L130 88" stroke="#c94c46" strokeWidth="3" />
        <rect x="52" y="84" width="96" height="16" rx="8" fill="#f2f0e9" />
        <circle cx="100" cy="40" r="10" fill="#f2f0e9" />
      </g>
    )
    case 'chef': return (
      <g className="wear-hat">
        <circle cx="76" cy="62" r="16" fill="#fff" stroke="#d9dcd6" strokeWidth="2" /><circle cx="124" cy="62" r="16" fill="#fff" stroke="#d9dcd6" strokeWidth="2" />
        <circle cx="100" cy="50" r="20" fill="#fff" stroke="#d9dcd6" strokeWidth="2" />
        <path d="M70 66 Q100 58 130 66" stroke="#fff" strokeWidth="14" />
        <rect x="68" y="62" width="64" height="28" rx="4" fill="#fff" stroke="#e3e3e3" strokeWidth="2" />
        <path d="M80 70 V88 M100 70 V88 M120 70 V88" stroke="#e8e8e8" strokeWidth="2" />
      </g>
    )
    case 'party': return (
      <g className="wear-hat" transform="rotate(-14 100 84)">
        <path d="M80 86 L100 30 L120 86 Z" fill="#9b6cf0" />
        <path d="M88 64 L112 64 M84 76 L116 76 M93 50 L107 50" stroke="#ffd45c" strokeWidth="5" strokeLinecap="round" />
        <circle cx="100" cy="28" r="7" fill="#ff7aa8" />
      </g>
    )
    case 'viking': return (
      <g className="wear-hat">
        <path d="M62 84 Q38 76 40 46 Q50 68 72 74 Z" fill="#f4ecd8" stroke="#d8ccae" strokeWidth="2" />
        <path d="M138 84 Q162 76 160 46 Q150 68 128 74 Z" fill="#f4ecd8" stroke="#d8ccae" strokeWidth="2" />
        <path d="M58 92 Q58 52 100 50 Q142 52 142 92 Z" fill="#9aa5b1" />
        <rect x="56" y="84" width="88" height="12" rx="5" fill="#c9971c" />
        <path d="M100 50 V86" stroke="#c9971c" strokeWidth="6" />
        {[70, 85, 115, 130].map((x) => <circle key={x} cx={x} cy="90" r="2.4" fill="#8a6400" />)}
      </g>
    )
    case 'crown': return (
      <g className="wear-hat">
        <path d="M68 88 L64 54 L82 70 L100 46 L118 70 L136 54 L132 88 Z" fill="#ffd45c" stroke="#c9971c" strokeWidth="3" strokeLinejoin="round" />
        <circle cx="100" cy="74" r="5" fill="#e0565b" /><circle cx="80" cy="79" r="3.5" fill="#3a7bd5" /><circle cx="120" cy="79" r="3.5" fill="#3a7bd5" />
        <circle cx="64" cy="52" r="4" fill="#ffd45c" /><circle cx="100" cy="44" r="4" fill="#ffd45c" /><circle cx="136" cy="52" r="4" fill="#ffd45c" />
      </g>
    )
    default: return null
  }
}

/** Drawn behind the body. */
export function GearBack({ id }: { id?: string }) {
  if (id === 'cape') return <path className="wear-cape" d="M54 108 Q28 150 38 184 L162 184 Q172 150 146 108 Z" fill="#e0565b" />
  return null
}

/** Drawn on top of the face and body. */
export function GearFront({ id, shoulderL = 46, shoulderR = 154, flexing = false }: { id?: string; shoulderL?: number; shoulderR?: number; flexing?: boolean }) {
  switch (id) {
    case 'shades': return (
      <g className="wear-gear">
        <path d="M64 104 H92 Q92 120 79 120 Q66 120 64 104 Z M108 104 H136 Q134 120 121 120 Q108 120 108 104 Z" fill="#1d2a24" />
        <path d="M60 104 H140 M92 106 Q100 101 108 106" stroke="#1d2a24" strokeWidth="4" fill="none" strokeLinecap="round" />
        <path d="M70 108 L76 108 M114 108 L120 108" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" opacity=".6" />
      </g>
    )
    case 'bands': {
      const pts = flexing ? [[shoulderL - 20, 104], [shoulderR + 20, 104]] : [[shoulderL - 14, 146], [shoulderR + 14, 146]]
      return <g className="wear-gear">{pts.map(([x, y], i) => <rect key={i} x={x - 9} y={y - 5} width="18" height="10" rx="4" fill="#f2f0e9" stroke="#e0565b" strokeWidth="3" />)}</g>
    }
    case 'bowtie': return (
      <g className="wear-gear">
        <path d="M100 150 L80 140 L80 160 Z M100 150 L120 140 L120 160 Z" fill="#e0565b" />
        <rect x="94" y="144" width="12" height="12" rx="3" fill="#c94c46" />
      </g>
    )
    case 'scarf': return (
      <g className="wear-gear">
        <path d="M60 142 Q100 160 140 142 L142 154 Q100 172 58 154 Z" fill="#3a7bd5" />
        <path d="M120 152 L128 182 L114 182 L110 156 Z" fill="#3a7bd5" />
        <path d="M72 148 L74 158 M90 152 L91 163 M110 152 L109 163 M128 148 L126 158" stroke="#ffd45c" strokeWidth="3" />
      </g>
    )
    case 'medal': return (
      <g className="wear-gear">
        <path d="M84 140 L100 162 L116 140" stroke="#e0565b" strokeWidth="6" fill="none" />
        <circle cx="100" cy="166" r="10" fill="#ffd45c" stroke="#c9971c" strokeWidth="2.5" />
        <path d="M100 160 l2 4 4 .5 -3 3 .8 4 -3.8 -2 -3.8 2 .8 -4 -3 -3 4 -.5 Z" fill="#c9971c" />
      </g>
    )
    case 'headphones': return (
      <g className="wear-gear">
        <path d="M50 108 Q50 56 100 56 Q150 56 150 108" stroke="#2f3a35" strokeWidth="7" fill="none" />
        <rect x="40" y="98" width="18" height="28" rx="8" fill="#9b6cf0" />
        <rect x="142" y="98" width="18" height="28" rx="8" fill="#9b6cf0" />
      </g>
    )
    default: return null
  }
}
