import type { CSSProperties, ReactNode } from 'react';

declare global {
  interface Window {
    storage?: {
      get: (key: string) => Promise<{ value: string } | null>;
      set: (key: string, value: string) => Promise<void>;
    };
  }
}

export type Devise = 'CAD' | 'EUR' | 'USD';
export type Tab = 'home' | 'depense' | 'argent' | 'reglages';

export type Compte = {
  id: string;
  label: string;
  devise: Devise;
  flag: string;
};

export type Depense = {
  id: number;
  date: string;
  desc: string;
  cat: string;
  montant: number;
  compte: string;
};

export type Revenu = {
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

export type Virement = {
  id: number;
  date: string;
  desc: string;
  montant: number;
  source: string;
  dest: string;
};

export type Fixe = {
  id: number;
  nom: string;
  montant: number | string;
};

export type Soldes = Record<string, number>;

export type StoreValue = Depense[] | Revenu[] | Virement[] | Fixe[] | Compte[] | Soldes | number;

export type ModalState = { type: 'dep'; data: Depense } | null;

export type StyleMap = Record<string, CSSProperties>;
export type FieldProps = { lbl: string; children: ReactNode };
export type IconProps = { a: boolean };
