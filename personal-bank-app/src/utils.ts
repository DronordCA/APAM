import type { Devise } from './types';

export const today = () => new Date().toISOString().slice(0, 10);
export const curMonth = () => today().slice(0, 7);
export const moisLbl = () => new Date().toLocaleString('fr-FR', { month: 'long', year: 'numeric' });

export const fmtCAD = (n: number) =>
  new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(
    Math.round(n),
  );

export const fmtEUR = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(
    Math.round(n),
  );

export const fmtUSD = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(
    Math.round(n),
  );

export const fmtNum = (n: number, devise: Devise) => {
  if (devise === 'EUR') return fmtEUR(n);
  if (devise === 'USD') return fmtUSD(n);
  return fmtCAD(n);
};
