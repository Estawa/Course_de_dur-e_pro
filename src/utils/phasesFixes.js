// Contenu des phases Échauffement et Récupération de fin de séance : identique pour toutes les
// séances de la bibliothèque et pendant tout le cycle (seule la phase Travail varie selon le
// thème de la séance). Défini une seule fois ici pour être réutilisé par SeanceRunner (séances
// de bibliothèque) et, à terme, par la Séance vierge et les tests, sans duplication.

export const ECHAUFFEMENT_FIXE = {
  duree_s: 8 * 60,
  pctVmaMin: 65,
  distanceMinM: 800,
  gammes: [
    'Montées de genoux',
    'Talons fesses',
    'Pas chassés x2',
    'Pas chassés alternés G/D',
    'Croisés / décroisés',
    'Course en arrière',
    'Foulées bondissantes',
    "Pattes d'oie (griffé)",
    'Cloche pied G/D',
    'Accélérations progressives sur 50m x4'
  ],
  gammesDistanceM: 15,
  retourAuCalme: 'Marche et étirements souples.'
}

export const RECUPERATION_FIXE = {
  duree_s: 5 * 60,
  pctVmaMin: 55,
  distanceMinM: 400,
  retourAuCalme: 'Marche et étirements souples, puis bilan de séance.'
}
