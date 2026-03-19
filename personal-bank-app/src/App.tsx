import { useCallback, useEffect, useMemo, useState } from 'react';

declare global {
  interface Window {
    storage?: {
      get: (key: string) => Promise<{ value: string } | null>;
      set: (key: string, value: string) => Promise<void>;
    };
  }
}

type Devise = 'CAD' | 'EUR' | 'USD';
type Tab = 'home' | 'depense' | 'argent' | 'reglages';
type ModalState = { type: 'dep'; data: Depense } | null;

type Compte = {
  id: string;
  label: string;
  devise: Devise;
  flag: string;
};

type Depense = {
  id: number;
  date: string;
  desc: string;
  cat: string;
  montant: number;
  compte: string;
};

type Revenu = {
  id: number;
  date: string;
  desc: string;
  montant: number;
  montantNatif: number;
  montantCAD: number;
  devise: Devise;
  taux: number;
  compte: string;
};

type Virement = {
  id: number;
  date: string;
  desc: string;
  montant: number;
  source: string;
  dest: string;
};

type Fixe = {
  id: number;
  nom: string;
  montant: number | string;
};

type Soldes = Record<string, number>;

type StoreValue = Depense[] | Revenu[] | Virement[] | Fixe[] | Compte[] | Soldes | number;

const store = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const result = await window.storage?.get(key);
      return result ? (JSON.parse(result.value) as T) : null;
    } catch {
      return null;
    }
  },
  async set(key: string, value: StoreValue) {
    try {
      await window.storage?.set(key, JSON.stringify(value));
    } catch {
      // noop
    }
  },
};

const DEFAULT_COMPTES: Compte[] = [
  { id: 'budget_ca', label: 'Budget Canada', devise: 'CAD', flag: '🍁' },
  { id: 'epargne_ca', label: 'Épargne Canada', devise: 'CAD', flag: '🍁' },
  { id: 'joint_fr', label: 'Compte joint FR', devise: 'EUR', flag: '🇫🇷' },
  { id: 'livret_fr', label: 'Livret A', devise: 'EUR', flag: '🇫🇷' },
];

const CATS = [
  'Alimentation',
  'Restaurants',
  'Transport',
  'Santé',
  'Vêtements',
  'Loisirs',
  'Voyages',
  'Sport',
  'Cadeaux',
  'Hygiène',
  'Culture',
  'Divers',
];

const FLAGS = ['🍁', '🇫🇷', '🏦', '💶', '💵', '💴', '🏠', '💳', '📈', '🌍', '💰', '🏧'];

const DEFAULT_FIXES: Fixe[] = [
  { id: 1, nom: 'Loyer / Hypothèque', montant: 1500 },
  { id: 2, nom: 'Téléphones', montant: 90 },
  { id: 3, nom: 'Assurances', montant: 100 },
  { id: 4, nom: 'Abonnements', montant: 30 },
  { id: 5, nom: 'Chat', montant: 60 },
];

const today = () => new Date().toISOString().slice(0, 10);
const fmtCAD = (n: number) =>
  new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(
    Math.round(n),
  );
const fmtEUR = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(
    Math.round(n),
  );
const fmtUSD = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(
    Math.round(n),
  );
const fmtNum = (n: number, d: Devise) => {
  if (d === 'EUR') return fmtEUR(n);
  if (d === 'USD') return fmtUSD(n);
  return fmtCAD(n);
};
const curMonth = () => today().slice(0, 7);
const moisLbl = () => new Date().toLocaleString('fr-FR', { month: 'long', year: 'numeric' });

function App() {
  const [tab, setTab] = useState<Tab>('home');
  const [depenses, setDep] = useState<Depense[]>([]);
  const [revenus, setRev] = useState<Revenu[]>([]);
  const [virements, setVir] = useState<Virement[]>([]);
  const [fixes, setFixes] = useState<Fixe[]>(DEFAULT_FIXES);
  const [comptes, setComptes] = useState<Compte[]>(DEFAULT_COMPTES);
  const [ouv, setOuv] = useState<Soldes>({ budget_ca: 2100, epargne_ca: 15000, joint_fr: 2000, livret_fr: 8000 });
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

  const addDep = useCallback(
    async (item: Depense) => {
      const next = [item, ...depenses];
      void persist('dep', setDep, next);
      flash('Dépense enregistrée');
    },
    [depenses, persist],
  );

  const addRev = useCallback(
    async (item: Revenu) => {
      const next = [item, ...revenus];
      void persist('rev', setRev, next);
      flash('Revenu enregistré');
    },
    [revenus, persist],
  );

  const addVir = useCallback(
    async (item: Virement) => {
      const next = [item, ...virements];
      void persist('vir', setVir, next);
      flash('Virement enregistré');
    },
    [virements, persist],
  );

  const delDep = useCallback(
    async (id: number) => {
      const next = depenses.filter((dep) => dep.id !== id);
      void persist('dep', setDep, next);
      flash('Supprimé');
    },
    [depenses, persist],
  );

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
  const virMoisBudget = virements
    .filter((virement) => virement.dest === budId && virement.date?.startsWith(cm))
    .reduce((acc, virement) => acc + (parseFloat(String(virement.montant)) || 0), 0);
  const totalFixes = fixes.reduce((acc, fixe) => acc + (parseFloat(String(fixe.montant)) || 0), 0);
  const depBudgetMois = depMois
    .filter((depense) => depense.compte === budId)
    .reduce((acc, depense) => acc + (parseFloat(String(depense.montant)) || 0), 0);
  const soldeMois = virMoisBudget - totalFixes - depBudgetMois;

  if (!loaded) {
    return (
      <div style={S.splash}>
        <div style={S.loader} />
      </div>
    );
  }

  return (
    <div style={S.app}>
      <style>{CSS}</style>
      {toast && <div style={S.toast}>{toast}</div>}
      {modal?.type === 'dep' && (
        <DepDetail
          dep={modal.data}
          comptes={comptes}
          onDelete={() => {
            void delDep(modal.data.id);
            setModal(null);
          }}
          onClose={() => setModal(null)}
        />
      )}

      <div style={S.screen}>
        {tab === 'home' && (
          <Home
            soldes={soldes}
            patrimoineCAD={patrimoineCAD}
            taux={taux}
            soldeMois={soldeMois}
            virMoisBudget={virMoisBudget}
            totalFixes={totalFixes}
            depBudgetMois={depBudgetMois}
            depMois={depMois}
            comptes={comptes}
            onDepClick={(dep) => setModal({ type: 'dep', data: dep })}
          />
        )}
        {tab === 'depense' && <AddDep comptes={comptes} onAdd={(dep) => {
          void addDep(dep);
          setTab('home');
        }} />}
        {tab === 'argent' && (
          <Argent
            taux={taux}
            comptes={comptes}
            onRevenu={(revenu) => {
              void addRev(revenu);
              setTab('home');
            }}
            onVirement={(virement) => {
              void addVir(virement);
              setTab('home');
            }}
          />
        )}
        {tab === 'reglages' && (
          <Reglages
            fixes={fixes}
            comptes={comptes}
            ouv={ouv}
            taux={taux}
            soldes={soldes}
            depenses={depenses}
            revenus={revenus}
            virements={virements}
            onSaveFixes={(value) => {
              void persist('fix', setFixes, value);
              flash('Enregistré');
            }}
            onSaveComptes={(value) => {
              void persist('comptes', setComptes, value);
            }}
            onSaveOuv={(value) => {
              void persist('ouv', setOuv, value);
            }}
            onSaveTaux={(value) => {
              void persist('taux', setTaux, value);
              flash('Taux mis à jour');
            }}
          />
        )}
      </div>

      <nav style={S.nav}>
        {[
          ['home', HomeIco, 'Accueil'],
          ['depense', PlusIco, 'Dépense'],
          ['argent', ArrowIco, 'Argent'],
          ['reglages', GearIco, 'Réglages'],
        ].map(([id, Ico, label]) => (
          <button
            key={id}
            style={{ ...S.navBtn, ...(tab === id ? { color: '#0F7A5A' } : {}) }}
            onClick={() => setTab(id as Tab)}
          >
            <Ico a={tab === id} />
            <span style={{ fontSize: 10, marginTop: 2, color: tab === id ? '#0F7A5A' : '#aaa', fontWeight: 500 }}>
              {label}
            </span>
          </button>
        ))}
      </nav>
    </div>
  );
}

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

function Home({ soldes, patrimoineCAD, taux, soldeMois, virMoisBudget, totalFixes, depBudgetMois, depMois, comptes, onDepClick }: HomeProps) {
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
          <div
            style={{
              fontSize: 34,
              fontWeight: 800,
              letterSpacing: -1,
              marginBottom: 12,
              color: soldeMois < 0 ? '#A32D2D' : '#0D1B2A',
            }}
          >
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
              <div
                key={cat}
                style={{ ...S.row, ...(index < cats.length - 1 ? { borderBottom: '1px solid #F5F5F5' } : {}) }}
              >
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
                style={{
                  ...S.row,
                  ...(index < Math.min(depMois.length, 8) - 1 ? { borderBottom: '1px solid #F5F5F5' } : {}),
                  cursor: 'pointer',
                }}
                onClick={() => onDepClick(dep)}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: '#1A1A1A' }}>{dep.desc}</div>
                  <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>
                    {dep.cat || '—'} · {dep.date}
                  </div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#A32D2D', flexShrink: 0, marginLeft: 8 }}>
                  {fmtCAD(dep.montant)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: '#aaa', fontSize: 14, padding: '32px 0' }}>
            Aucune dépense ce mois · appuyez sur ＋
          </div>
        )}
      </div>
    </div>
  );
}

type PillProps = {
  c: string;
  bg: string;
  lbl: string;
  v: string;
};

function Pill({ c, bg, lbl, v }: PillProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, flex: 1 }}>
      <span
        style={{
          fontSize: 10,
          color: '#888',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: 0.4,
        }}
      >
        {lbl}
      </span>
      <span style={{ fontSize: 12, fontWeight: 700, color: c, background: bg, padding: '3px 8px', borderRadius: 20 }}>
        {v}
      </span>
    </div>
  );
}

type DepDetailProps = {
  dep: Depense;
  onDelete: () => void;
  onClose: () => void;
  comptes: Compte[];
};

function DepDetail({ dep, onDelete, onClose, comptes }: DepDetailProps) {
  const compte = comptes.find((item) => item.id === dep.compte);

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={(event) => event.stopPropagation()}>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#111', marginBottom: 6 }}>{dep.desc}</div>
        <div style={{ fontSize: 32, fontWeight: 800, color: '#A32D2D', marginBottom: 6 }}>{fmtCAD(dep.montant)}</div>
        <div style={{ fontSize: 14, color: '#888', marginBottom: 2 }}>
          {dep.cat || '—'} · {dep.date}
        </div>
        <div style={{ fontSize: 14, color: '#888', marginBottom: 20 }}>
          {compte ? `${compte.flag || '🏦'} ${compte.label}` : dep.compte}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={S.btnGhost} onClick={onClose}>
            Fermer
          </button>
          <button
            style={{ ...S.btnGhost, background: '#FDEAEA', color: '#A32D2D', border: 'none' }}
            onClick={onDelete}
          >
            Supprimer
          </button>
        </div>
      </div>
    </div>
  );
}

type AddDepProps = {
  comptes: Compte[];
  onAdd: (dep: Depense) => void;
};

function AddDep({ comptes, onAdd }: AddDepProps) {
  const [f, setF] = useState({ date: today(), desc: '', cat: '', montant: '', compte: comptes[0]?.id || '' });
  const [err, setErr] = useState('');

  const go = () => {
    if (!f.desc.trim()) return setErr('Description requise');
    const montant = parseFloat(f.montant);
    if (!montant || montant <= 0) return setErr('Montant invalide');
    return onAdd({ ...f, montant, id: Date.now() });
  };

  return (
    <div style={S.fp}>
      <div style={S.fhdr}>Nouvelle dépense</div>
      <div style={S.fc}>
        <F lbl="Date">
          <input style={S.inp} type="date" value={f.date} onChange={(event) => setF({ ...f, date: event.target.value })} />
        </F>
        <F lbl="Description *">
          <input
            style={S.inp}
            placeholder="Ex : Épicerie IGA"
            value={f.desc}
            onChange={(event) => setF({ ...f, desc: event.target.value })}
          />
        </F>
        <F lbl="Catégorie">
          <select style={S.inp} value={f.cat} onChange={(event) => setF({ ...f, cat: event.target.value })}>
            <option value="">— optionnel —</option>
            {CATS.map((cat) => (
              <option key={cat}>{cat}</option>
            ))}
          </select>
        </F>
        <F lbl="Montant (CAD) *">
          <input
            style={S.inp}
            type="number"
            inputMode="decimal"
            placeholder="0.00"
            value={f.montant}
            onChange={(event) => setF({ ...f, montant: event.target.value })}
          />
        </F>
        <F lbl="Compte prélevé">
          <select style={S.inp} value={f.compte} onChange={(event) => setF({ ...f, compte: event.target.value })}>
            {comptes.map((compte) => (
              <option key={compte.id} value={compte.id}>
                {compte.flag || '🏦'} {compte.label}
              </option>
            ))}
          </select>
        </F>
        {err && <div style={S.err}>{err}</div>}
        <button style={S.btnP} onClick={go}>
          Enregistrer
        </button>
      </div>
    </div>
  );
}

type ArgentProps = {
  taux: number;
  comptes: Compte[];
  onRevenu: (revenu: Revenu) => void;
  onVirement: (virement: Virement) => void;
};

function Argent({ taux, comptes, onRevenu, onVirement }: ArgentProps) {
  const [mode, setMode] = useState<'rev' | 'vir'>('rev');
  const [rev, setRev] = useState({
    date: today(),
    desc: '',
    montant: '',
    devise: 'CAD' as Devise,
    taux,
    compte: comptes[0]?.id || '',
  });
  const [vir, setVir] = useState({
    date: today(),
    desc: '',
    montant: '',
    source: comptes[0]?.id || '',
    dest: comptes[0]?.id || '',
  });
  const [err, setErr] = useState('');

  const goRev = () => {
    const montant = parseFloat(rev.montant);
    if (!montant || montant <= 0) return setErr('Montant invalide');
    const localTaux = parseFloat(String(rev.taux)) || taux;
    return onRevenu({
      ...rev,
      montant,
      montantNatif: montant,
      montantCAD: rev.devise === 'EUR' ? montant * localTaux : montant,
      taux: localTaux,
      id: Date.now(),
    });
  };

  const goVir = () => {
    const montant = parseFloat(vir.montant);
    if (!montant || montant <= 0) return setErr('Montant invalide');
    if (vir.source === vir.dest) return setErr('Source et destination identiques');
    return onVirement({ ...vir, montant, id: Date.now() });
  };

  return (
    <div style={S.fp}>
      <div style={S.fhdr}>Argent</div>
      <div style={S.seg}>
        <button style={{ ...S.segB, ...(mode === 'rev' ? S.segA : {}) }} onClick={() => {
          setMode('rev');
          setErr('');
        }}>
          Revenu / Salaire
        </button>
        <button style={{ ...S.segB, ...(mode === 'vir' ? S.segA : {}) }} onClick={() => {
          setMode('vir');
          setErr('');
        }}>
          Virement
        </button>
      </div>
      {mode === 'rev' && (
        <div style={S.fc}>
          <div style={S.info}>Salaire ou revenu entrant → choisissez le compte destination</div>
          <F lbl="Date">
            <input style={S.inp} type="date" value={rev.date} onChange={(event) => setRev({ ...rev, date: event.target.value })} />
          </F>
          <F lbl="Description">
            <input
              style={S.inp}
              placeholder="Ex : Salaire mars"
              value={rev.desc}
              onChange={(event) => setRev({ ...rev, desc: event.target.value })}
            />
          </F>
          <F lbl="Montant *">
            <input
              style={S.inp}
              type="number"
              inputMode="decimal"
              placeholder="0.00"
              value={rev.montant}
              onChange={(event) => setRev({ ...rev, montant: event.target.value })}
            />
          </F>
          <F lbl="Devise">
            <select style={S.inp} value={rev.devise} onChange={(event) => setRev({ ...rev, devise: event.target.value as Devise })}>
              <option value="CAD">CAD</option>
              <option value="EUR">EUR</option>
            </select>
          </F>
          {rev.devise === 'EUR' && (
            <>
              <F lbl="Taux EUR → CAD">
                <input
                  style={S.inp}
                  type="number"
                  step="0.0001"
                  value={rev.taux}
                  onChange={(event) => setRev({ ...rev, taux: Number(event.target.value) || event.target.value })}
                />
              </F>
              {rev.montant && (
                <div style={{ fontSize: 14, color: '#0F7A5A', fontWeight: 700, paddingBottom: 6 }}>
                  ≈ {fmtCAD(parseFloat(rev.montant) * (parseFloat(String(rev.taux)) || taux))}
                </div>
              )}
            </>
          )}
          <F lbl="Vers compte">
            <select style={S.inp} value={rev.compte} onChange={(event) => setRev({ ...rev, compte: event.target.value })}>
              {comptes.map((compte) => (
                <option key={compte.id} value={compte.id}>
                  {compte.flag || '🏦'} {compte.label}
                </option>
              ))}
            </select>
          </F>
          {err && <div style={S.err}>{err}</div>}
          <button style={S.btnP} onClick={goRev}>
            Enregistrer
          </button>
        </div>
      )}
      {mode === 'vir' && (
        <div style={S.fc}>
          <div style={S.info}>Ex : Épargne Canada → Compte budget Canada en début de mois</div>
          <F lbl="Date">
            <input style={S.inp} type="date" value={vir.date} onChange={(event) => setVir({ ...vir, date: event.target.value })} />
          </F>
          <F lbl="Description">
            <input
              style={S.inp}
              placeholder="Ex : Budget mars"
              value={vir.desc}
              onChange={(event) => setVir({ ...vir, desc: event.target.value })}
            />
          </F>
          <F lbl="Compte source">
            <select style={S.inp} value={vir.source} onChange={(event) => setVir({ ...vir, source: event.target.value })}>
              {comptes.map((compte) => (
                <option key={compte.id} value={compte.id}>
                  {compte.flag || '🏦'} {compte.label}
                </option>
              ))}
            </select>
          </F>
          <div style={{ textAlign: 'center', fontSize: 22, color: '#ccc', padding: '4px 0' }}>↓</div>
          <F lbl="Compte destination">
            <select style={S.inp} value={vir.dest} onChange={(event) => setVir({ ...vir, dest: event.target.value })}>
              {comptes.map((compte) => (
                <option key={compte.id} value={compte.id}>
                  {compte.flag || '🏦'} {compte.label}
                </option>
              ))}
            </select>
          </F>
          <F lbl="Montant *">
            <input
              style={S.inp}
              type="number"
              inputMode="decimal"
              placeholder="0.00"
              value={vir.montant}
              onChange={(event) => setVir({ ...vir, montant: event.target.value })}
            />
          </F>
          {err && <div style={S.err}>{err}</div>}
          <button style={S.btnP} onClick={goVir}>
            Enregistrer
          </button>
        </div>
      )}
    </div>
  );
}

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

function Reglages({
  fixes,
  comptes,
  ouv,
  taux,
  soldes,
  depenses,
  revenus,
  virements,
  onSaveFixes,
  onSaveComptes,
  onSaveOuv,
  onSaveTaux,
}: ReglagesProps) {
  const [sec, setSec] = useState<'comptes' | 'fixes' | 'taux'>('comptes');
  const [lFix, setLFix] = useState(fixes);
  const [lComp, setLComp] = useState(comptes);
  const [lOuv, setLOuv] = useState(ouv);
  const [lTaux, setLTaux] = useState<number | string>(taux);
  const [saved, setSaved] = useState(false);
  const [adding, setAdding] = useState(false);
  const [nc, setNc] = useState<{ label: string; devise: Devise; flag: string }>({ label: '', devise: 'CAD', flag: '🏦' });

  const flash = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

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

  const updC = (id: string, field: keyof Compte, value: string) =>
    setLComp(lComp.map((compte) => (compte.id === id ? { ...compte, [field]: value } : compte)));
  const totalFixes = lFix.reduce((acc, fixe) => acc + (parseFloat(String(fixe.montant)) || 0), 0);

  return (
    <div style={S.fp}>
      <div style={S.fhdr}>Réglages</div>
      <div style={S.seg}>
        {[
          ['comptes', 'Comptes'],
          ['fixes', 'Fixes'],
          ['taux', 'Taux'],
        ].map(([id, label]) => (
          <button key={id} style={{ ...S.segB, ...(sec === id ? S.segA : {}) }} onClick={() => setSec(id as 'comptes' | 'fixes' | 'taux')}>
            {label}
          </button>
        ))}
      </div>

      {sec === 'comptes' && (
        <div style={{ paddingBottom: 100 }}>
          <div style={S.fc}>
            <div style={S.ctitle}>Soldes en cours</div>
            {comptes.map((compte) => (
              <div key={compte.id} style={{ ...S.row, borderBottom: '1px solid #F5F5F5' }}>
                <span style={{ fontSize: 14, color: '#222' }}>
                  {compte.flag || '🏦'} {compte.label}
                </span>
                <span style={{ fontSize: 14, fontWeight: 700, color: compte.devise === 'EUR' ? '#854F0B' : '#0F7A5A' }}>
                  {fmtNum(soldes[compte.id] || 0, compte.devise)}
                </span>
              </div>
            ))}
            <div style={{ display: 'flex', borderTop: '1px solid #F0F0F0', marginTop: 8 }}>
              {[
                { val: depenses.length, lbl: 'dépenses' },
                { val: revenus.length, lbl: 'revenus' },
                { val: virements.length, lbl: 'virements' },
              ].map(({ val, lbl }) => (
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
                  <select
                    style={{ ...S.inp, width: 58, marginBottom: 0, padding: '10px 4px', textAlign: 'center' }}
                    value={compte.flag || '🏦'}
                    onChange={(event) => updC(compte.id, 'flag', event.target.value)}
                  >
                    {FLAGS.map((flag) => (
                      <option key={flag} value={flag}>
                        {flag}
                      </option>
                    ))}
                  </select>
                  <input
                    style={{ ...S.inp, flex: 1, marginBottom: 0 }}
                    placeholder="Nom"
                    value={compte.label}
                    onChange={(event) => updC(compte.id, 'label', event.target.value)}
                  />
                  <select
                    style={{ ...S.inp, width: 68, marginBottom: 0 }}
                    value={compte.devise}
                    onChange={(event) => updC(compte.id, 'devise', event.target.value)}
                  >
                    <option value="CAD">CAD</option>
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                  </select>
                  {lComp.length > 1 && (
                    <button style={S.delBtn} onClick={() => delCompte(compte.id)}>
                      ✕
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: '#999', flexShrink: 0 }}>Ouverture :</span>
                  <input
                    style={{ ...S.inp, flex: 1, marginBottom: 0 }}
                    type="number"
                    value={lOuv[compte.id] || 0}
                    onChange={(event) => setLOuv({ ...lOuv, [compte.id]: parseFloat(event.target.value) || 0 })}
                  />
                </div>
              </div>
            ))}

            {adding ? (
              <div style={{ background: '#F7FDF9', borderRadius: 12, padding: 14, marginTop: 4 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#0F7A5A', marginBottom: 10 }}>Nouveau compte</div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <select
                    style={{ ...S.inp, width: 58, marginBottom: 0, padding: '10px 4px', textAlign: 'center' }}
                    value={nc.flag}
                    onChange={(event) => setNc({ ...nc, flag: event.target.value })}
                  >
                    {FLAGS.map((flag) => (
                      <option key={flag} value={flag}>
                        {flag}
                      </option>
                    ))}
                  </select>
                  <input
                    style={{ ...S.inp, flex: 1, marginBottom: 0 }}
                    placeholder="Nom du compte"
                    value={nc.label}
                    onChange={(event) => setNc({ ...nc, label: event.target.value })}
                    autoFocus
                  />
                  <select
                    style={{ ...S.inp, width: 68, marginBottom: 0 }}
                    value={nc.devise}
                    onChange={(event) => setNc({ ...nc, devise: event.target.value as Devise })}
                  >
                    <option value="CAD">CAD</option>
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={{ ...S.btnGhost, padding: '10px 16px', width: 'auto' }} onClick={() => setAdding(false)}>
                    Annuler
                  </button>
                  <button style={{ ...S.btnP, marginTop: 0, flex: 1 }} onClick={addCompte}>
                    Ajouter
                  </button>
                </div>
              </div>
            ) : (
              <button style={{ ...S.btnGhost, marginTop: 4 }} onClick={() => setAdding(true)}>
                + Ajouter un compte
              </button>
            )}
            <button style={{ ...S.btnP, ...(saved ? { background: '#0F7A5A' } : {}) }} onClick={saveAll}>
              {saved ? 'Enregistré ✓' : 'Enregistrer les modifications'}
            </button>
          </div>
        </div>
      )}

      {sec === 'fixes' && (
        <div style={{ ...S.fc, paddingBottom: 100 }}>
          <div style={S.ctitle}>Dépenses fixes mensuelles</div>
          <div style={S.info}>Saisir une fois · Prélevé sur le compte budget</div>
          {lFix.map((fixe) => (
            <div key={fixe.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
              <input
                style={{ ...S.inp, flex: 1, marginBottom: 0 }}
                placeholder="Nom"
                value={fixe.nom}
                onChange={(event) => setLFix(lFix.map((item) => (item.id === fixe.id ? { ...item, nom: event.target.value } : item)))}
              />
              <input
                style={{ ...S.inp, width: 90, marginBottom: 0, textAlign: 'right' }}
                type="number"
                value={fixe.montant}
                onChange={(event) =>
                  setLFix(lFix.map((item) => (item.id === fixe.id ? { ...item, montant: event.target.value } : item)))
                }
              />
              <button style={S.delBtn} onClick={() => setLFix(lFix.filter((item) => item.id !== fixe.id))}>
                ✕
              </button>
            </div>
          ))}
          <button style={S.btnGhost} onClick={() => setLFix([...lFix, { id: Date.now(), nom: '', montant: 0 }])}>
            + Ajouter
          </button>
          <div style={{ fontSize: 14, color: '#555', borderTop: '1px solid #F0F0F0', paddingTop: 12, marginTop: 8 }}>
            Total mensuel : <strong>{fmtCAD(totalFixes)}</strong>
          </div>
          <button style={{ ...S.btnP, ...(saved ? { background: '#0F7A5A' } : {}) }} onClick={saveAll}>
            {saved ? 'Enregistré ✓' : 'Enregistrer'}
          </button>
        </div>
      )}

      {sec === 'taux' && (
        <div style={{ ...S.fc, paddingBottom: 100 }}>
          <div style={S.ctitle}>Taux EUR → CAD</div>
          <div style={S.info}>Mettez à jour lors d'un virement France → Canada pour refléter le taux réel.</div>
          <F lbl="Taux actuel">
            <input style={S.inp} type="number" step="0.0001" value={lTaux} onChange={(event) => setLTaux(event.target.value)} />
          </F>
          <div style={{ fontSize: 14, color: '#0F7A5A', fontWeight: 700, paddingBottom: 8 }}>
            1 EUR = {parseFloat(String(lTaux || 1)).toFixed(4)} CAD
          </div>
          <button style={{ ...S.btnP, ...(saved ? { background: '#0F7A5A' } : {}) }} onClick={saveAll}>
            {saved ? 'Enregistré ✓' : 'Enregistrer'}
          </button>
        </div>
      )}
    </div>
  );
}

type FieldProps = {
  lbl: string;
  children: React.ReactNode;
};

function F({ lbl, children }: FieldProps) {
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

type IconProps = {
  a: boolean;
};

function HomeIco({ a }: IconProps) {
  return (
    <svg style={{ width: 22, height: 22 }} viewBox="0 0 24 24" fill="none" stroke={a ? '#0F7A5A' : '#bbb'} strokeWidth="2" strokeLinecap="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function PlusIco({ a }: IconProps) {
  return (
    <svg style={{ width: 22, height: 22 }} viewBox="0 0 24 24" fill="none" stroke={a ? '#0F7A5A' : '#bbb'} strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  );
}

function ArrowIco({ a }: IconProps) {
  return (
    <svg style={{ width: 22, height: 22 }} viewBox="0 0 24 24" fill="none" stroke={a ? '#0F7A5A' : '#bbb'} strokeWidth="2" strokeLinecap="round">
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 11V9a4 4 0 014-4h14" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 13v2a4 4 0 01-4 4H3" />
    </svg>
  );
}

function GearIco({ a }: IconProps) {
  return (
    <svg style={{ width: 22, height: 22 }} viewBox="0 0 24 24" fill="none" stroke={a ? '#0F7A5A' : '#bbb'} strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  );
}

const S: Record<string, React.CSSProperties> = {
  app: {
    fontFamily: "-apple-system,BlinkMacSystemFont,'SF Pro Display',sans-serif",
    maxWidth: 430,
    margin: '0 auto',
    minHeight: '100dvh',
    display: 'flex',
    flexDirection: 'column',
    background: '#F0F2F5',
  },
  splash: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh' },
  loader: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    border: '3px solid #E4F5EF',
    borderTopColor: '#0F7A5A',
    animation: 'spin .7s linear infinite',
  },
  screen: { flex: 1, overflowY: 'auto' },
  toast: {
    position: 'fixed',
    top: 16,
    left: '50%',
    transform: 'translateX(-50%)',
    background: '#0D1B2A',
    color: '#fff',
    padding: '10px 20px',
    borderRadius: 24,
    fontSize: 14,
    fontWeight: 600,
    zIndex: 200,
    whiteSpace: 'nowrap',
  },
  hero: { background: '#0D1B2A', padding: '52px 24px 28px' },
  eyebrow: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: '#3D6B7A',
    marginBottom: 8,
  },
  heroAmt: { fontSize: 44, fontWeight: 800, color: '#fff', letterSpacing: -1.5, lineHeight: 1, marginBottom: 6 },
  heroSub: { fontSize: 18, color: '#3D8FA8', fontWeight: 500, marginBottom: 12 },
  heroDate: { fontSize: 12, color: '#2D5060', fontStyle: 'italic' },
  section: { padding: '12px 16px 0' },
  slbl: {
    fontSize: 11,
    fontWeight: 700,
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  cCard: { background: '#fff', borderRadius: 16, padding: '14px 14px 16px' },
  cLbl: {
    fontSize: 11,
    fontWeight: 600,
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  cAmt: { fontSize: 19, fontWeight: 800 },
  soldeCard: { background: '#fff', borderRadius: 16, padding: '18px 18px 16px' },
  cardW: { background: '#fff', borderRadius: 16, padding: '16px' },
  ctitle: {
    fontSize: 11,
    fontWeight: 700,
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0' },
  nav: {
    position: 'fixed',
    bottom: 0,
    left: '50%',
    transform: 'translateX(-50%)',
    width: '100%',
    maxWidth: 430,
    display: 'flex',
    background: '#fff',
    borderTop: '1px solid #EBEBEB',
    paddingBottom: 'env(safe-area-inset-bottom,6px)',
    zIndex: 100,
  },
  navBtn: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '9px 0 6px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    gap: 3,
  },
  fp: { paddingBottom: 100 },
  fhdr: { background: '#0D1B2A', color: '#fff', padding: '52px 20px 20px', fontSize: 22, fontWeight: 800, letterSpacing: -0.5 },
  fc: { margin: '16px', background: '#fff', borderRadius: 16, padding: '18px' },
  inp: {
    display: 'block',
    width: '100%',
    boxSizing: 'border-box',
    padding: '12px 14px',
    borderRadius: 10,
    border: '1.5px solid #E8E8E8',
    fontSize: 15,
    color: '#111',
    background: '#FAFAFA',
    outline: 'none',
    appearance: 'none',
    marginBottom: 2,
    fontFamily: 'inherit',
  },
  btnP: {
    width: '100%',
    padding: '14px',
    borderRadius: 12,
    border: 'none',
    background: '#0D1B2A',
    color: '#fff',
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer',
    marginTop: 18,
    fontFamily: 'inherit',
  },
  btnGhost: {
    width: '100%',
    padding: '12px',
    borderRadius: 10,
    border: '1.5px solid #ddd',
    background: 'none',
    color: '#555',
    fontSize: 14,
    cursor: 'pointer',
    fontFamily: 'inherit',
    marginTop: 4,
  },
  seg: { display: 'flex', margin: '14px 16px 0', background: '#E8E8E8', borderRadius: 10, padding: 3, gap: 2 },
  segB: {
    flex: 1,
    padding: '9px 4px',
    borderRadius: 8,
    border: 'none',
    background: 'none',
    fontSize: 13,
    color: '#777',
    cursor: 'pointer',
    fontWeight: 500,
    fontFamily: 'inherit',
  },
  segA: { background: '#fff', color: '#0D1B2A', fontWeight: 700, boxShadow: '0 1px 3px rgba(0,0,0,.1)' },
  err: { background: '#FDEAEA', color: '#A32D2D', borderRadius: 10, padding: '9px 12px', fontSize: 13, marginTop: 8 },
  info: { background: '#EEF6F3', color: '#0D5A3F', borderRadius: 10, padding: '10px 12px', fontSize: 13, marginBottom: 14, lineHeight: 1.5 },
  delBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    border: 'none',
    background: '#FDEAEA',
    color: '#A32D2D',
    cursor: 'pointer',
    fontSize: 14,
    flexShrink: 0,
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,.45)',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    zIndex: 150,
  },
  modal: { background: '#fff', borderRadius: '20px 20px 0 0', padding: '28px 24px 40px', width: '100%', maxWidth: 430 },
};

const CSS = `
*{-webkit-tap-highlight-color:transparent;box-sizing:border-box;}
input:focus,select:focus{border-color:#0F7A5A!important;outline:none;box-shadow:0 0 0 3px rgba(15,122,90,.1);}
button:active{opacity:.8;transform:scale(.98);}
@keyframes spin{to{transform:rotate(360deg);}}
select{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24'%3E%3Cpath fill='%23999' d='M7 10l5 5 5-5z'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;padding-right:32px;}
`;

export default App;
