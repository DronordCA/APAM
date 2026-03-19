import type { Compte, Fixe } from './types';

export const DEFAULT_COMPTES: Compte[] = [
  { id: 'budget_ca', label: 'Budget Canada', devise: 'CAD', flag: '🍁' },
  { id: 'epargne_ca', label: 'Épargne Canada', devise: 'CAD', flag: '🍁' },
  { id: 'joint_fr', label: 'Compte joint FR', devise: 'EUR', flag: '🇫🇷' },
  { id: 'livret_fr', label: 'Livret A', devise: 'EUR', flag: '🇫🇷' },
];

export const CATS = [
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

export const FLAGS = ['🍁', '🇫🇷', '🏦', '💶', '💵', '💴', '🏠', '💳', '📈', '🌍', '💰', '🏧'];

export const DEFAULT_FIXES: Fixe[] = [
  { id: 1, nom: 'Loyer / Hypothèque', montant: 1500 },
  { id: 2, nom: 'Téléphones', montant: 90 },
  { id: 3, nom: 'Assurances', montant: 100 },
  { id: 4, nom: 'Abonnements', montant: 30 },
  { id: 5, nom: 'Chat', montant: 60 },
];

export const DEFAULT_OUVERTURES = {
  budget_ca: 2100,
  epargne_ca: 15000,
  joint_fr: 2000,
  livret_fr: 8000,
};
