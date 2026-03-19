import { S } from '../styles';
import type { Compte, Depense } from '../types';
import { fmtCAD } from '../utils';

type DepDetailProps = {
  dep: Depense;
  onDelete: () => void;
  onClose: () => void;
  comptes: Compte[];
};

export function DepDetail({ dep, onDelete, onClose, comptes }: DepDetailProps) {
  const compte = comptes.find((item) => item.id === dep.compte);

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={(event) => event.stopPropagation()}>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#111', marginBottom: 6 }}>{dep.desc}</div>
        <div style={{ fontSize: 32, fontWeight: 800, color: '#A32D2D', marginBottom: 6 }}>{fmtCAD(dep.montant)}</div>
        <div style={{ fontSize: 14, color: '#888', marginBottom: 2 }}>{dep.cat || '—'} · {dep.date}</div>
        <div style={{ fontSize: 14, color: '#888', marginBottom: 20 }}>{compte ? `${compte.flag || '🏦'} ${compte.label}` : dep.compte}</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={S.btnGhost} onClick={onClose}>Fermer</button>
          <button style={{ ...S.btnGhost, background: '#FDEAEA', color: '#A32D2D', border: 'none' }} onClick={onDelete}>Supprimer</button>
        </div>
      </div>
    </div>
  );
}
