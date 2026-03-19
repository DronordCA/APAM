import { useState } from 'react';
import { FLAGS } from '../constants';
import { S } from '../styles';
import type { Compte, Depense, Devise, Fixe, Revenu, Soldes, Virement } from '../types';
import { fmtCAD, fmtNum } from '../utils';
import { F } from './shared';

type ReglagesProps = {
  fixes: Fixe[];
  comptes: Compte[];
  ouv: Soldes;
  taux: number;
  soldes: Soldes;
  depenses: Depense[];
  revenus: Revenu[];
  virements: Virement[];
  onSaveFixes: (fixes: Fixe[]) => void;
  onSaveComptes: (comptes: Compte[]) => void;
  onSaveOuv: (ouv: Soldes) => void;
  onSaveTaux: (taux: number) => void;
};

export function Reglages({ fixes, comptes, ouv, taux, soldes, depenses, revenus, virements, onSaveFixes, onSaveComptes, onSaveOuv, onSaveTaux }: ReglagesProps) {
  const [sec, setSec] = useState<'comptes' | 'fixes' | 'taux'>('comptes');
  const [lFix, setLFix] = useState(fixes);
  const [lComp, setLComp] = useState(comptes);
  const [lOuv, setLOuv] = useState(ouv);
  const [lTaux, setLTaux] = useState<number | string>(taux);
  const [saved, setSaved] = useState(false);
  const [adding, setAdding] = useState(false);
  const [nc, setNc] = useState<{ label: string; devise: Devise; flag: string }>({ label: '', devise: 'CAD', flag: '🏦' });

  const flash = () => { setSaved(true); setTimeout(() => setSaved(false), 1500); };

  const saveAll = () => {
    onSaveFixes(lFix);
    onSaveComptes(lComp);
    onSaveOuv(lOuv);
    onSaveTaux(parseFloat(String(lTaux)) || taux);
    flash();
  };

  const addCompte = () => {
    if (!nc.label.trim()) return;
    const id = `c_${Date.now()}`;
    const updated = [...lComp, { ...nc, id, label: nc.label.trim() }];
    const updOuv = { ...lOuv, [id]: 0 };
    setLComp(updated);
    setLOuv(updOuv);
    onSaveComptes(updated);
    onSaveOuv(updOuv);
    setNc({ label: '', devise: 'CAD', flag: '🏦' });
    setAdding(false);
    flash();
  };

  const delCompte = (id: string) => {
    if (lComp.length <= 1) return;
    const updated = lComp.filter((compte) => compte.id !== id);
    const { [id]: _removed, ...restOuv } = lOuv;
    setLComp(updated);
    setLOuv(restOuv);
    onSaveComptes(updated);
    onSaveOuv(restOuv);
  };

  const updC = (id: string, field: keyof Compte, value: string) => setLComp(lComp.map((compte) => (compte.id === id ? { ...compte, [field]: value } : compte)));
  const totalFixes = lFix.reduce((acc, fixe) => acc + (parseFloat(String(fixe.montant)) || 0), 0);

  return (
    <div style={S.fp}>
      <div style={S.fhdr}>Réglages</div>
      <div style={S.seg}>
        {[['comptes', 'Comptes'], ['fixes', 'Fixes'], ['taux', 'Taux']].map(([id, label]) => (
          <button key={id} style={{ ...S.segB, ...(sec === id ? S.segA : {}) }} onClick={() => setSec(id as 'comptes' | 'fixes' | 'taux')}>{label}</button>
        ))}
      </div>

      {sec === 'comptes' && (
        <div style={{ paddingBottom: 100 }}>
          <div style={S.fc}>
            <div style={S.ctitle}>Soldes en cours</div>
            {comptes.map((compte) => (
              <div key={compte.id} style={{ ...S.row, borderBottom: '1px solid #F5F5F5' }}>
                <span style={{ fontSize: 14, color: '#222' }}>{compte.flag || '🏦'} {compte.label}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: compte.devise === 'EUR' ? '#854F0B' : '#0F7A5A' }}>{fmtNum(soldes[compte.id] || 0, compte.devise)}</span>
              </div>
            ))}
            <div style={{ display: 'flex', borderTop: '1px solid #F0F0F0', marginTop: 8 }}>
              {[{ val: depenses.length, lbl: 'dépenses' }, { val: revenus.length, lbl: 'revenus' }, { val: virements.length, lbl: 'virements' }].map(({ val, lbl }) => (
                <div key={lbl} style={{ flex: 1, textAlign: 'center', paddingTop: 12 }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#0D1B2A' }}>{val}</div>
                  <div style={{ fontSize: 11, color: '#999' }}>{lbl}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={S.fc}>
            <div style={S.ctitle}>Gérer les comptes</div>
            {lComp.map((compte) => (
              <div key={compte.id} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid #F5F5F5' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                  <select style={{ ...S.inp, width: 58, marginBottom: 0, padding: '10px 4px', textAlign: 'center' }} value={compte.flag || '🏦'} onChange={(event) => updC(compte.id, 'flag', event.target.value)}>
                    {FLAGS.map((flag) => <option key={flag} value={flag}>{flag}</option>)}
                  </select>
                  <input style={{ ...S.inp, flex: 1, marginBottom: 0 }} placeholder="Nom" value={compte.label} onChange={(event) => updC(compte.id, 'label', event.target.value)} />
                  <select style={{ ...S.inp, width: 68, marginBottom: 0 }} value={compte.devise} onChange={(event) => updC(compte.id, 'devise', event.target.value)}>
                    <option value="CAD">CAD</option>
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                  </select>
                  {lComp.length > 1 && <button style={S.delBtn} onClick={() => delCompte(compte.id)}>✕</button>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: '#999', flexShrink: 0 }}>Ouverture :</span>
                  <input style={{ ...S.inp, flex: 1, marginBottom: 0 }} type="number" value={lOuv[compte.id] || 0} onChange={(event) => setLOuv({ ...lOuv, [compte.id]: parseFloat(event.target.value) || 0 })} />
                </div>
              </div>
            ))}

            {adding ? (
              <div style={{ background: '#F7FDF9', borderRadius: 12, padding: 14, marginTop: 4 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#0F7A5A', marginBottom: 10 }}>Nouveau compte</div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <select style={{ ...S.inp, width: 58, marginBottom: 0, padding: '10px 4px', textAlign: 'center' }} value={nc.flag} onChange={(event) => setNc({ ...nc, flag: event.target.value })}>
                    {FLAGS.map((flag) => <option key={flag} value={flag}>{flag}</option>)}
                  </select>
                  <input style={{ ...S.inp, flex: 1, marginBottom: 0 }} placeholder="Nom du compte" value={nc.label} onChange={(event) => setNc({ ...nc, label: event.target.value })} autoFocus />
                  <select style={{ ...S.inp, width: 68, marginBottom: 0 }} value={nc.devise} onChange={(event) => setNc({ ...nc, devise: event.target.value as Devise })}>
                    <option value="CAD">CAD</option>
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={{ ...S.btnGhost, padding: '10px 16px', width: 'auto' }} onClick={() => setAdding(false)}>Annuler</button>
                  <button style={{ ...S.btnP, marginTop: 0, flex: 1 }} onClick={addCompte}>Ajouter</button>
                </div>
              </div>
            ) : (
              <button style={{ ...S.btnGhost, marginTop: 4 }} onClick={() => setAdding(true)}>+ Ajouter un compte</button>
            )}
            <button style={{ ...S.btnP, ...(saved ? { background: '#0F7A5A' } : {}) }} onClick={saveAll}>{saved ? 'Enregistré ✓' : 'Enregistrer les modifications'}</button>
          </div>
        </div>
      )}

      {sec === 'fixes' && (
        <div style={{ ...S.fc, paddingBottom: 100 }}>
          <div style={S.ctitle}>Dépenses fixes mensuelles</div>
          <div style={S.info}>Saisir une fois · Prélevé sur le compte budget</div>
          {lFix.map((fixe) => (
            <div key={fixe.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
              <input style={{ ...S.inp, flex: 1, marginBottom: 0 }} placeholder="Nom" value={fixe.nom} onChange={(event) => setLFix(lFix.map((item) => (item.id === fixe.id ? { ...item, nom: event.target.value } : item)))} />
              <input style={{ ...S.inp, width: 90, marginBottom: 0, textAlign: 'right' }} type="number" value={fixe.montant} onChange={(event) => setLFix(lFix.map((item) => (item.id === fixe.id ? { ...item, montant: event.target.value } : item)))} />
              <button style={S.delBtn} onClick={() => setLFix(lFix.filter((item) => item.id !== fixe.id))}>✕</button>
            </div>
          ))}
          <button style={S.btnGhost} onClick={() => setLFix([...lFix, { id: Date.now(), nom: '', montant: 0 }])}>+ Ajouter</button>
          <div style={{ fontSize: 14, color: '#555', borderTop: '1px solid #F0F0F0', paddingTop: 12, marginTop: 8 }}>Total mensuel : <strong>{fmtCAD(totalFixes)}</strong></div>
          <button style={{ ...S.btnP, ...(saved ? { background: '#0F7A5A' } : {}) }} onClick={saveAll}>{saved ? 'Enregistré ✓' : 'Enregistrer'}</button>
        </div>
      )}

      {sec === 'taux' && (
        <div style={{ ...S.fc, paddingBottom: 100 }}>
          <div style={S.ctitle}>Taux EUR → CAD</div>
          <div style={S.info}>Mettez à jour lors d'un virement France → Canada pour refléter le taux réel.</div>
          <F lbl="Taux actuel"><input style={S.inp} type="number" step="0.0001" value={lTaux} onChange={(event) => setLTaux(event.target.value)} /></F>
          <div style={{ fontSize: 14, color: '#0F7A5A', fontWeight: 700, paddingBottom: 8 }}>1 EUR = {parseFloat(String(lTaux || 1)).toFixed(4)} CAD</div>
          <button style={{ ...S.btnP, ...(saved ? { background: '#0F7A5A' } : {}) }} onClick={saveAll}>{saved ? 'Enregistré ✓' : 'Enregistrer'}</button>
        </div>
      )}
    </div>
  );
}
