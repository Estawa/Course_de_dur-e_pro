// Les séances (y compris celles déjà enregistrées) continuent de stocker en interne
// 'Facile' / 'Moyen' / 'Difficile' comme nom de niveau (niveau.nom, niveauNom des
// réalisations, etc.) — changer cette valeur casserait la compatibilité avec toutes les
// séances et réalisations déjà en base. Seul l'AFFICHAGE change : partout où un nom de
// niveau est montré à l'élève ou au prof, on passe par libelleNiveau() pour afficher
// "Niveau 1/2/3" au lieu du nom interne.
const LIBELLES = {
  Facile: 'Niveau 1',
  Moyen: 'Niveau 2',
  Difficile: 'Niveau 3'
}

export function libelleNiveau(nom) {
  return LIBELLES[nom] || nom
}
