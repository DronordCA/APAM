import { useCallback, useEffect, useMemo, useState } from 'react';
import { DEFAULT_COMPTES, DEFAULT_FIXES, DEFAULT_OUVERTURES } from './constants';
import { AddDep } from './components/AddDep';
import { Argent } from './components/Argent';
import { DepDetail } from './components/DepDetail';
import { Home } from './components/Home';
import { Reglages } from './components/Reglages';
import { ArrowIco, GearIco, HomeIco, PlusIco } from './components/shared';
import { store } from './store';
import { CSS, S } from './styles';
import type { Compte, Depense, Fixe, ModalState, Revenu, Soldes, StoreValue, Tab, Virement } from './types';
import { curMonth } from './utils';

function App() {
  const [tab, setTab] = useState<Tab>('home');
  const [depenses, setDep] = useState<Depense[]>([]);
  const [revenus, setRev] = useState<Revenu[]>([]);
  const [virements, setVir] = useState<Virement[]>([]);
  const [fixes, setFixes] = useState<Fixe[]>(DEFAULT_FIXES);
  const [comptes, setComptes] = useState<Compte[]>(DEFAULT_COMPTES);
  const [ouv, setOuv] = useState<Soldes>(DEFAULT_OUVERTURES);
  const [taux, setTaux] = useState(1.46);
  const [loaded, setLoaded] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>(null);

  useEffect(() => {
    void (async () => {
      const [d, r, v, f, c, o, t] = await Promise.all([
        store.get<Depense[]>('dep'),
        store.get<Revenu[]>('rev'),
        store.get<Virement[]>('vir'),
        store.get<Fixe[]>('fix'),
        store.get<Compte[]>('comptes'),
        store.get<Soldes>('ouv'),
        store.get<number>('taux'),
      ]);

      if (d) setDep(d);
      if (r) setRev(r);
      if (v) setVir(v);
      if (f) setFixes(f);
      if (c) setComptes(c);
      if (o) setOuv(o);
      if (t) setTaux(t);
      setLoaded(true);
    })();
  }, []);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  const persist = useCallback(async <T extends StoreValue>(key: string, setter: (value: T) => void, value: T) => {
    setter(value);
    await store.set(key, value);
  }, []);

  const addDep = useCallback((item: Depense) => {
    const next = [item, ...depenses];
    void persist('dep', setDep, next);
    flash('Dépense enregistrée');
  }, [depenses, persist]);

  const addRev = useCallback((item: Revenu) => {
    const next = [item, ...revenus];
    void persist('rev', setRev, next);
    flash('Revenu enregistré');
  }, [revenus, persist]);

  const addVir = useCallback((item: Virement) => {
    const next = [item, ...virements];
    void persist('vir', setVir, next);
    flash('Virement enregistré');
  }, [virements, persist]);

  const delDep = useCallback((id: number) => {
    const next = depenses.filter((dep) => dep.id !== id);
    void persist('dep', setDep, next);
    flash('Supprimé');
  }, [depenses, persist]);

  const soldes = useMemo(() => {
    const current: Soldes = { ...ouv };

    comptes.forEach((compte) => {
      if (current[compte.id] === undefined) current[compte.id] = 0;
    });

    revenus.forEach((revenu) => {
      if (current[revenu.compte] !== undefined) current[revenu.compte] += parseFloat(String(revenu.montantNatif)) || 0;
    });

    virements.forEach((virement) => {
      if (current[virement.source] !== undefined) current[virement.source] -= parseFloat(String(virement.montant)) || 0;
      if (current[virement.dest] !== undefined) current[virement.dest] += parseFloat(String(virement.montant)) || 0;
    });

    depenses.forEach((depense) => {
      if (current[depense.compte] !== undefined) current[depense.compte] -= parseFloat(String(depense.montant)) || 0;
    });

    return current;
  }, [comptes, depenses, revenus, virements, ouv]);

  const patrimoineCAD = useMemo(
    () => comptes.reduce((acc, compte) => acc + (soldes[compte.id] || 0) * (compte.devise === 'EUR' ? taux : 1), 0),
    [comptes, soldes, taux],
  );

  const cm = curMonth();
  const depMois = depenses.filter((dep) => dep.date?.startsWith(cm));
  const budId = comptes.find((compte) => compte.id === 'budget_ca')?.id || comptes[0]?.id;
  const virMoisBudget = virements.filter((virement) => virement.dest === budId && virement.date?.startsWith(cm)).reduce((acc, virement) => acc + (parseFloat(String(virement.montant)) || 0), 0);
  const totalFixes = fixes.reduce((acc, fixe) => acc + (parseFloat(String(fixe.montant)) || 0), 0);
  const depBudgetMois = depMois.filter((depense) => depense.compte === budId).reduce((acc, depense) => acc + (parseFloat(String(depense.montant)) || 0), 0);
  const soldeMois = virMoisBudget - totalFixes - depBudgetMois;

  if (!loaded) {
    return <div style={S.splash}><div style={S.loader} /></div>;
  }

  return (
    <div style={S.app}>
      <style>{CSS}</style>
      {toast && <div style={S.toast}>{toast}</div>}
      {modal?.type === 'dep' && <DepDetail dep={modal.data} comptes={comptes} onDelete={() => { delDep(modal.data.id); setModal(null); }} onClose={() => setModal(null)} />}

      <div style={S.screen}>
        {tab === 'home' && <Home soldes={soldes} patrimoineCAD={patrimoineCAD} taux={taux} soldeMois={soldeMois} virMoisBudget={virMoisBudget} totalFixes={totalFixes} depBudgetMois={depBudgetMois} depMois={depMois} comptes={comptes} onDepClick={(dep) => setModal({ type: 'dep', data: dep })} />}
        {tab === 'depense' && <AddDep comptes={comptes} onAdd={(dep) => { addDep(dep); setTab('home'); }} />}
        {tab === 'argent' && <Argent taux={taux} comptes={comptes} onRevenu={(revenu) => { addRev(revenu); setTab('home'); }} onVirement={(virement) => { addVir(virement); setTab('home'); }} />}
        {tab === 'reglages' && <Reglages fixes={fixes} comptes={comptes} ouv={ouv} taux={taux} soldes={soldes} depenses={depenses} revenus={revenus} virements={virements} onSaveFixes={(value) => { void persist('fix', setFixes, value); flash('Enregistré'); }} onSaveComptes={(value) => { void persist('comptes', setComptes, value); }} onSaveOuv={(value) => { void persist('ouv', setOuv, value); }} onSaveTaux={(value) => { void persist('taux', setTaux, value); flash('Taux mis à jour'); }} />}
      </div>

      <nav style={S.nav}>
        {[
          ['home', HomeIco, 'Accueil'],
          ['depense', PlusIco, 'Dépense'],
          ['argent', ArrowIco, 'Argent'],
          ['reglages', GearIco, 'Réglages'],
        ].map(([id, Ico, label]) => (
          <button key={id} style={{ ...S.navBtn, ...(tab === id ? { color: '#0F7A5A' } : {}) }} onClick={() => setTab(id as Tab)}>
            <Ico a={tab === id} />
            <span style={{ fontSize: 10, marginTop: 2, color: tab === id ? '#0F7A5A' : '#aaa', fontWeight: 500 }}>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

export default App;
