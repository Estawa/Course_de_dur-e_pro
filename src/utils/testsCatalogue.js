// Métadonnées des 5 tests, utilisées pour :
//  - la zone "Tests" de la bibliothèque enseignant (sélection + envoi aux classes)
//  - la carte "Tests à venir" côté élève (objectif + déroulement + différences de niveaux,
//    JAMAIS la logique de notation)
export const TESTS_CATALOGUE = [
  {
    id: 'cooper',
    titre: 'Test VMA — Demi-Cooper (6 minutes)',
    objectif: "Courir la plus grande distance possible en 6 minutes, à l'allure la plus régulière possible.",
    deroulement: '1 seul effort continu de 6 minutes à allure maximale soutenable.',
    niveaux: null
  },
  {
    id: '4x3',
    titre: 'Test VMA — 4 × 3 minutes',
    objectif: 'Courir la plus grande distance possible sur chacune des 4 répétitions de 3 minutes.',
    deroulement: '4 répétitions de 3 minutes à allure maximale, séparées de 4 min 30 de récupération marchée.',
    niveaux: null
  },
  {
    id: 'gacon',
    titre: 'Test VMA/VMI — Gacon (45/15)',
    objectif: 'Enchaîner le plus grand nombre de paliers de course à vitesse imposée croissante.',
    deroulement: "Paliers de 45s de course suivis de 15s de marche pour rejoindre le plot suivant. La vitesse augmente de 0,5 km/h à chaque palier (départ 8 km/h).",
    niveaux: null
  },
  {
    id: 'vameval',
    titre: 'Test VMA — VAM-EVAL',
    objectif: 'Enchaîner le plus grand nombre de paliers de course à vitesse imposée croissante, sans récupération.',
    deroulement: "Paliers continus d'1 minute, sans récupération, vitesse augmentant de 0,5 km/h à chaque palier (départ 7 km/h).",
    niveaux: null
  },
  {
    id: 'fartlek',
    titre: 'Évaluation — Fartlek sur piste',
    objectif: 'Enchaîner les zones intenses et de récupération sur un tour de 400m pendant la durée effective minimale de ton niveau, en gérant tes éventuels arrêts.',
    deroulement: 'Tour de 400m avec 2 zones intenses et 2 zones de récupération active alternées (plots), plus une zone de repos de 20m au niveau de la ligne de départ/arrivée où tu peux t\'arrêter. Un arrêt en dehors de cette zone reste possible mais compte contre toi.',
    niveaux: [
      { nom: 'Facile', description: 'Zones intenses 40m, récup 160m — durée effective minimale 20 min' },
      { nom: 'Moyen', description: 'Zones intenses 50m, récup 150m — durée effective minimale 22 min' },
      { nom: 'Difficile', description: 'Zones intenses 60m, récup 140m — durée effective minimale 25 min' }
    ]
  }
]

export function testParId(id) {
  return TESTS_CATALOGUE.find((t) => t.id === id) || null
}
