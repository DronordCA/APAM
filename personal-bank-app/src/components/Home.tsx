import { S } from '../styles';
import type { Compte, Depense, Soldes } from '../types';
import { fmtCAD, fmtEUR, fmtNum, moisLbl } from '../utils';
import { Pill } from './shared';

type HomeProps = {
  soldes: Soldes;
  patrimoineCAD: number;
  taux: number;
  soldeMois: number;
  virMoisBudget: number;
  totalFixes: number;
  depBudgetMois: number;
  depMois: Depense[];
  comptes: Compte[];
  onDepClick: (dep: Depense) => void;
};

export function Home({ soldes, patrimoineCAD, taux, soldeMois, virMoisBudget, totalFixes, depBudgetMois, depMois, comptes, onDepClick }: HomeProps) {
  const catTotals: Record<string, number> = {};
  depMois.forEach((dep) => {
    if (dep.cat) catTotals[dep.cat] = (catTotals[dep.cat] || 0) + (parseFloat(String(dep.montant)) || 0);
  });
  const cats = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);

  return (
    <div>
      <div style={S.hero}>
        <div style={S.eyebrow}>Patrimoine total</div>
        <div style={S.heroAmt}>{fmtCAD(patrimoineCAD)}</div>
        <div style={S.heroSub}>{fmtEUR(patrimoineCAD / taux)}</div>
        <div style={S.heroDate}>{moisLbl()}</div>
      </div>

      <div style={S.section}>
        <div style={S.slbl}>Vos comptes</div>
        <div style={S.grid2}>
          {comptes.map((compte) => (
            <div key={compte.id} style={{ ...S.cCard, ...(compte.devise === 'EUR' ? { background: '#FFFDF5' } : {}) }}>
              <div style={{ fontSize: 18, marginBottom: 5 }}>{compte.flag || '🏦'}</div>
              <div style={S.cLbl}>{compte.label}</div>
              <div style={{ ...S.cAmt, color: compte.devise === 'EUR' ? '#854F0B' : '#0F7A5A' }}>
                {fmtNum(soldes[compte.id] || 0, compte.devise)}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={S.section}>
        <div style={{ ...S.soldeCard, ...(soldeMois < 0 ? { background: '#FFF8F8' } : {}) }}>
          <div style={S.slbl}>Solde ce mois</div>
          <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: -1, marginBottom: 12, color: soldeMois < 0 ? '#A32D2D' : '#0D1B2A' }}>
            {fmtCAD(soldeMois)}
          </div>
          <div style={{ display: 'flex', gap: 8, borderTop: '1px solid #F0F0F0', paddingTop: 12 }}>
            <Pill c="#0F7A5A" bg="#E4F5EF" lbl="Reçus" v={fmtCAD(virMoisBudget)} />
            <Pill c="#1A5FA8" bg="#EAF1FB" lbl="Fixes" v={fmtCAD(totalFixes)} />
            <Pill c="#854F0B" bg="#FDF6E3" lbl="Variables" v={fmtCAD(depBudgetMois)} />
          </div>
        </div>
      </div>

      {cats.length > 0 && (
        <div style={S.section}>
          <div style={S.cardW}>
            <div style={S.ctitle}>Ce mois par catégorie</div>
            {cats.map(([cat, total], index) => (
              <div key={cat} style={{ ...S.row, ...(index < cats.length - 1 ? { borderBottom: '1px solid #F5F5F5' } : {}) }}>
                <span style={{ fontSize: 14, color: '#222' }}>{cat}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#854F0B' }}>{fmtCAD(total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ ...S.section, paddingBottom: 100 }}>
        {depMois.length > 0 ? (
          <div style={S.cardW}>
            <div style={S.ctitle}>Dernières dépenses</div>
            {depMois.slice(0, 8).map((dep, index) => (
              <div
                key={dep.id}
                style={{ ...S.row, ...(index < Math.min(depMois.length, 8) - 1 ? { borderBottom: '1px solid #F5F5F5' } : {}), cursor: 'pointer' }}
                onClick={() => onDepClick(dep)}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: '#1A1A1A' }}>{dep.desc}</div>
                  <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>{dep.cat || '—'} · {dep.date}</div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#A32D2D', flexShrink: 0, marginLeft: 8 }}>{fmtCAD(dep.montant)}</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: '#aaa', fontSize: 14, padding: '32px 0' }}>Aucune dépense ce mois · appuyez sur ＋</div>
        )}
      </div>
    </div>
  );
}
