// Barème de la note "réelle" des séances (utils/calc.js → noteBlocReelle / calculerNoteReelle).
// Cette note n'est JAMAIS montrée à l'élève (qui ne voit que sa note "déclarée", basée sur son
// propre choix Réussi/Partiel/Non réussi dans le bilan de bloc) : elle sert uniquement à
// l'enseignant, via noteFinale (Élèves & suivi) et la moyenne de cycle.
//
// Modifie les valeurs ci-dessous pour ajuster les pondérations au fil des séances — le calcul
// (calc.js) et l'écran de référence enseignant (BaremeNotation.jsx) lisent tous les deux ce
// fichier, donc les deux restent toujours synchronisés.
//
// ---------------------------------------------------------------------------------------------
// PRINCIPE GÉNÉRAL (par bloc, puis moyenne des blocs = note de séance) :
//
//   1. Plafond = 20 × (distance/durée réalisée ÷ distance/durée prévue), jamais > 20.
//      → Un élève qui n'a couvert que la moitié de la distance prévue ne peut pas dépasser 10,
//        quelle que soit la qualité du reste.
//
//   2. Qualité d'exécution = moyenne pondérée (sur 20) des critères mesurés hors distance :
//      allure, régularité, récupération — voir poidsQualiteBloc. Un critère non mesurable pour
//      ce bloc (ex. pas de récup en dehors du mode Full Power) est simplement retiré du calcul,
//      les poids restants étant renormalisés.
//
//   3. Note de bloc (avant pénalités) = le plus petit des deux : min(Plafond, Qualité).
//
//   4. Pénalités de pauses, par bloc — voir penalitePauseParUnite / pausesTolereesParBloc /
//      plafondPenalitePauseBloc.
//
//   5. Pénalités de séance, une seule fois pour l'ensemble de la séance (pas par bloc) — voir
//      penalitePoulsManquant / penaliteBorgManquant / penaliteObservationManquante, plafonnées
//      globalement par plafondPenaliteSeance.
// ---------------------------------------------------------------------------------------------

export const BAREME = {
  // --- 2) Qualité d'exécution du bloc (hors distance), pondération sur 20 ---
  poidsQualiteBloc: {
    allure: 0.55,      // écart entre l'allure demandée et l'allure réellement tenue
    regularite: 0.25,  // régularité de l'allure d'une phase de travail à l'autre
    recup: 0.20        // respect de l'allure de récupération (mode Full Power uniquement)
  },

  // --- 4) Pénalités de pauses, par bloc ---
  pausesTolereesParBloc: 1,     // nombre de pauses non pénalisées par bloc (1 pause "normale" acceptée)
  penalitePauseParUnite: 0.5,   // points retirés par pause au-delà de la tolérance
  plafondPenalitePauseBloc: 2,  // retrait maximum lié aux pauses, par bloc

  // --- 5) Pénalités de séance (une fois, pas par bloc) ---
  penalitePoulsManquant: 0.5,        // par prise de pouls non renseignée (repos / avant / après travail / finale — 4 prises max)
  penaliteBorgManquant: 1,           // si aucune échelle de Borg n'a été renseignée sur la séance
  penaliteObservationManquante: 0.5, // si l'observation générale de fin de séance est vide
  plafondPenaliteSeance: 5           // retrait total maximum pour ces 3 points, pour qu'une séance
                                      // par ailleurs réussie ne soit pas écrasée par des oublis
                                      // administratifs mineurs
}
