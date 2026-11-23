// Ícones do protótipo (traço 2px, 24x24). Decorativos: o texto ao lado dá o significado.
import type { ReactNode } from "react";

function Svg({ size = 24, stroke = 2, children }: { size?: number; stroke?: number; children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}
type P = { size?: number };

export const IconHome = ({ size }: P) => <Svg size={size}><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /></Svg>;
export const IconScan = ({ size }: P) => <Svg size={size}><path d="M4 8V5a1 1 0 011-1h3M16 4h3a1 1 0 011 1v3M20 16v3a1 1 0 01-1 1h-3M8 20H5a1 1 0 01-1-1v-3" /><path d="M7 12h10" /></Svg>;
export const IconCart = ({ size }: P) => <Svg size={size}><circle cx="9" cy="20" r="1.5" /><circle cx="18" cy="20" r="1.5" /><path d="M2 3h3l2.5 12h11L21 7H6" /></Svg>;
export const IconDoc = ({ size }: P) => <Svg size={size}><path d="M6 2h9l5 5v15H6z" /><path d="M14 2v6h6M9 13h8M9 17h8" /></Svg>;
export const IconGear = ({ size }: P) => (
  <Svg size={size}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" />
  </Svg>
);
export const IconMoon = ({ size = 20 }: P) => <Svg size={size}><path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" /></Svg>;
export const IconUp = ({ size = 14 }: P) => <Svg size={size} stroke={2.5}><path d="M12 19V5M5 12l7-7 7 7" /></Svg>;
export const IconDown = ({ size = 14 }: P) => <Svg size={size} stroke={2.5}><path d="M12 5v14M5 12l7 7 7-7" /></Svg>;
export const IconKey = ({ size }: P) => <Svg size={size}><circle cx="8" cy="15" r="4" /><path d="M11 12l9-9M16 7l3 3" /></Svg>;
export const IconPaste = ({ size }: P) => <Svg size={size}><rect x="6" y="4" width="12" height="17" rx="2" /><path d="M9 4h6v3H9zM9 12h6M9 16h4" /></Svg>;
export const IconUpload = ({ size }: P) => <Svg size={size}><path d="M12 16V4M7 9l5-5 5 5M4 20h16" /></Svg>;
export const IconUser = ({ size }: P) => <Svg size={size}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0116 0" /></Svg>;
