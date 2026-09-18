/** Piccoli segni grafici usati nell'interfaccia (nessuna libreria esterna). */
export function Icona({ nome, size = 16 }: { nome: string; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  switch (nome) {
    case 'armata':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="7" />
          <path d="M12 8v8M8 12h8" />
        </svg>
      );
    case 'dadi':
      return (
        <svg {...common}>
          <rect x="4" y="4" width="16" height="16" rx="4" />
          <circle cx="9" cy="9" r="1.2" fill="currentColor" />
          <circle cx="15" cy="15" r="1.2" fill="currentColor" />
        </svg>
      );
    case 'attacco':
      return (
        <svg {...common}>
          <path d="M4 20 L20 4M15 4h5v5" />
        </svg>
      );
    case 'spostamento':
      return (
        <svg {...common}>
          <path d="M4 12h14M13 7l5 5-5 5" />
        </svg>
      );
    case 'rinforzo':
      return (
        <svg {...common}>
          <path d="M12 20V5M6 11l6-6 6 6" />
        </svg>
      );
    case 'carte':
      return (
        <svg {...common}>
          <rect x="4" y="5" width="11" height="15" rx="2" />
          <path d="M9 3h9a2 2 0 0 1 2 2v12" />
        </svg>
      );
    case 'bandiera':
      return (
        <svg {...common}>
          <path d="M6 21V4M6 4h12l-3 4 3 4H6" />
        </svg>
      );
    case 'obiettivo':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    case 'cronologia':
      return (
        <svg {...common}>
          <path d="M4 6h16M4 12h16M4 18h10" />
        </svg>
      );
    case 'chiudi':
      return (
        <svg {...common}>
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      );
    case 'aiuto':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M9.5 9.5a2.5 2.5 0 1 1 3.2 2.4c-.6.2-1 .8-1 1.4v.4" />
          <circle cx="12" cy="17" r="0.9" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'eliminazione':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M8 8l8 8" />
        </svg>
      );
    case 'vittoria':
      return (
        <svg {...common}>
          <path d="M8 4h8v5a4 4 0 0 1-8 0z" />
          <path d="M10 20h4M12 13v7" />
        </svg>
      );
    case 'turno':
    case 'fase':
      return (
        <svg {...common}>
          <path d="M20 12a8 8 0 1 1-2.3-5.6" />
          <path d="M20 4v5h-5" />
        </svg>
      );
    case 'inizio':
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.5" />
        </svg>
      );
  }
}
