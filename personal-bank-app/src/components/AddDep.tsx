import { useState } from 'react';
import { CATS } from '../constants';
import { S } from '../styles';
import type { Compte, Depense } from '../types';
import { today } from '../utils';
import { F } from './shared';

type AddDepProps = {
  comptes: Compte[];
  onAdd: (dep: Depense) => void;
};

export function AddDep({ comptes, onAdd }: AddDepProps) {
  const [f, setF] = useState({ date: today(), desc: '', cat: '', montant: '', compte: comptes[0]?.id || '' });
  const [err, setErr] = useState('');

  const go = () => {
    if (!f.desc.trim()) return setErr('Description requise');
    const montant = parseFloat(f.montant);
    if (!montant || montant <= 0) return setErr('Montant invalide');
    onAdd({ ...f, montant, id: Date.now() });
  };

  return (
    <div style={S.fp}>
      <div style={S.fhdr}>Nouvelle dépense</div>
      <div style={S.fc}>
        <F lbl="Date"><input style={S.inp} type="date" value={f.date} onChange={(event) => setF({ ...f, date: event.target.value })} /></F>
        <F lbl="Description *"><input style={S.inp} placeholder="Ex : Épicerie IGA" value={f.desc} onChange={(event) => setF({ ...f, desc: event.target.value })} /></F>
        <F lbl="Catégorie">
          <select style={S.inp} value={f.cat} onChange={(event) => setF({ ...f, cat: event.target.value })}>
            <option value="">— optionnel —</option>
            {CATS.map((cat) => <option key={cat}>{cat}</option>)}
          </select>
        </F>
        <F lbl="Montant (CAD) *"><input style={S.inp} type="number" inputMode="decimal" placeholder="0.00" value={f.montant} onChange={(event) => setF({ ...f, montant: event.target.value })} /></F>
        <F lbl="Compte prélevé">
          <select style={S.inp} value={f.compte} onChange={(event) => setF({ ...f, compte: event.target.value })}>
            {comptes.map((compte) => <option key={compte.id} value={compte.id}>{compte.flag || '🏦'} {compte.label}</option>)}
          </select>
        </F>
        {err && <div style={S.err}>{err}</div>}
        <button style={S.btnP} onClick={go}>Enregistrer</button>
      </div>
    </div>
  );
}
