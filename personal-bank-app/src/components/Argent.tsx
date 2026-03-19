import { useState } from 'react';
import { S } from '../styles';
import type { Compte, Devise, Revenu, Virement } from '../types';
import { fmtCAD, today } from '../utils';
import { F } from './shared';

type ArgentProps = {
  taux: number;
  comptes: Compte[];
  onRevenu: (revenu: Revenu) => void;
  onVirement: (virement: Virement) => void;
};

export function Argent({ taux, comptes, onRevenu, onVirement }: ArgentProps) {
  const [mode, setMode] = useState<'rev' | 'vir'>('rev');
  const [rev, setRev] = useState({ date: today(), desc: '', montant: '', devise: 'CAD' as Devise, taux, compte: comptes[0]?.id || '' });
  const [vir, setVir] = useState({ date: today(), desc: '', montant: '', source: comptes[0]?.id || '', dest: comptes[0]?.id || '' });
  const [err, setErr] = useState('');

  const goRev = () => {
    const montant = parseFloat(rev.montant);
    if (!montant || montant <= 0) return setErr('Montant invalide');
    const localTaux = parseFloat(String(rev.taux)) || taux;
    onRevenu({ ...rev, montant, montantNatif: montant, montantCAD: rev.devise === 'EUR' ? montant * localTaux : montant, taux: localTaux, id: Date.now() });
  };

  const goVir = () => {
    const montant = parseFloat(vir.montant);
    if (!montant || montant <= 0) return setErr('Montant invalide');
    if (vir.source === vir.dest) return setErr('Source et destination identiques');
    onVirement({ ...vir, montant, id: Date.now() });
  };

  return (
    <div style={S.fp}>
      <div style={S.fhdr}>Argent</div>
      <div style={S.seg}>
        <button style={{ ...S.segB, ...(mode === 'rev' ? S.segA : {}) }} onClick={() => { setMode('rev'); setErr(''); }}>Revenu / Salaire</button>
        <button style={{ ...S.segB, ...(mode === 'vir' ? S.segA : {}) }} onClick={() => { setMode('vir'); setErr(''); }}>Virement</button>
      </div>
      {mode === 'rev' && (
        <div style={S.fc}>
          <div style={S.info}>Salaire ou revenu entrant → choisissez le compte destination</div>
          <F lbl="Date"><input style={S.inp} type="date" value={rev.date} onChange={(event) => setRev({ ...rev, date: event.target.value })} /></F>
          <F lbl="Description"><input style={S.inp} placeholder="Ex : Salaire mars" value={rev.desc} onChange={(event) => setRev({ ...rev, desc: event.target.value })} /></F>
          <F lbl="Montant *"><input style={S.inp} type="number" inputMode="decimal" placeholder="0.00" value={rev.montant} onChange={(event) => setRev({ ...rev, montant: event.target.value })} /></F>
          <F lbl="Devise">
            <select style={S.inp} value={rev.devise} onChange={(event) => setRev({ ...rev, devise: event.target.value as Devise })}>
              <option value="CAD">CAD</option>
              <option value="EUR">EUR</option>
            </select>
          </F>
          {rev.devise === 'EUR' && (
            <>
              <F lbl="Taux EUR → CAD"><input style={S.inp} type="number" step="0.0001" value={rev.taux} onChange={(event) => setRev({ ...rev, taux: Number(event.target.value) || event.target.value })} /></F>
              {rev.montant && <div style={{ fontSize: 14, color: '#0F7A5A', fontWeight: 700, paddingBottom: 6 }}>≈ {fmtCAD(parseFloat(rev.montant) * (parseFloat(String(rev.taux)) || taux))}</div>}
            </>
          )}
          <F lbl="Vers compte">
            <select style={S.inp} value={rev.compte} onChange={(event) => setRev({ ...rev, compte: event.target.value })}>
              {comptes.map((compte) => <option key={compte.id} value={compte.id}>{compte.flag || '🏦'} {compte.label}</option>)}
            </select>
          </F>
          {err && <div style={S.err}>{err}</div>}
          <button style={S.btnP} onClick={goRev}>Enregistrer</button>
        </div>
      )}
      {mode === 'vir' && (
        <div style={S.fc}>
          <div style={S.info}>Ex : Épargne Canada → Compte budget Canada en début de mois</div>
          <F lbl="Date"><input style={S.inp} type="date" value={vir.date} onChange={(event) => setVir({ ...vir, date: event.target.value })} /></F>
          <F lbl="Description"><input style={S.inp} placeholder="Ex : Budget mars" value={vir.desc} onChange={(event) => setVir({ ...vir, desc: event.target.value })} /></F>
          <F lbl="Compte source">
            <select style={S.inp} value={vir.source} onChange={(event) => setVir({ ...vir, source: event.target.value })}>
              {comptes.map((compte) => <option key={compte.id} value={compte.id}>{compte.flag || '🏦'} {compte.label}</option>)}
            </select>
          </F>
          <div style={{ textAlign: 'center', fontSize: 22, color: '#ccc', padding: '4px 0' }}>↓</div>
          <F lbl="Compte destination">
            <select style={S.inp} value={vir.dest} onChange={(event) => setVir({ ...vir, dest: event.target.value })}>
              {comptes.map((compte) => <option key={compte.id} value={compte.id}>{compte.flag || '🏦'} {compte.label}</option>)}
            </select>
          </F>
          <F lbl="Montant *"><input style={S.inp} type="number" inputMode="decimal" placeholder="0.00" value={vir.montant} onChange={(event) => setVir({ ...vir, montant: event.target.value })} /></F>
          {err && <div style={S.err}>{err}</div>}
          <button style={S.btnP} onClick={goVir}>Enregistrer</button>
        </div>
      )}
    </div>
  );
}
