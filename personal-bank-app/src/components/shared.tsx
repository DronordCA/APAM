import type { FieldProps, IconProps } from '../types';
import { S } from '../styles';

export function F({ lbl, children }: FieldProps) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: '#555',
          marginBottom: 5,
          textTransform: 'uppercase',
          letterSpacing: 0.4,
        }}
      >
        {lbl}
      </div>
      {children}
    </div>
  );
}

export function Pill({ c, bg, lbl, v }: { c: string; bg: string; lbl: string; v: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, flex: 1 }}>
      <span style={{ fontSize: 10, color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {lbl}
      </span>
      <span style={{ fontSize: 12, fontWeight: 700, color: c, background: bg, padding: '3px 8px', borderRadius: 20 }}>
        {v}
      </span>
    </div>
  );
}

export function HomeIco({ a }: IconProps) {
  return (
    <svg style={{ width: 22, height: 22 }} viewBox="0 0 24 24" fill="none" stroke={a ? '#0F7A5A' : '#bbb'} strokeWidth="2" strokeLinecap="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

export function PlusIco({ a }: IconProps) {
  return (
    <svg style={{ width: 22, height: 22 }} viewBox="0 0 24 24" fill="none" stroke={a ? '#0F7A5A' : '#bbb'} strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  );
}

export function ArrowIco({ a }: IconProps) {
  return (
    <svg style={{ width: 22, height: 22 }} viewBox="0 0 24 24" fill="none" stroke={a ? '#0F7A5A' : '#bbb'} strokeWidth="2" strokeLinecap="round">
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 11V9a4 4 0 014-4h14" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 13v2a4 4 0 01-4 4H3" />
    </svg>
  );
}

export function GearIco({ a }: IconProps) {
  return (
    <svg style={{ width: 22, height: 22 }} viewBox="0 0 24 24" fill="none" stroke={a ? '#0F7A5A' : '#bbb'} strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  );
}

export { S };
