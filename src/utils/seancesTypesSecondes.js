// Bibliothèque de 7 séances types "course en durée" pour les Secondes, prêtes à importer
// depuis la bibliothèque enseignant. Chaque niveau est encodé en une seule structure
// Full Power (types A/B/C/D en %VMA), ce qui permet à l'appli de calculer automatiquement
// les objectifs (allure, distance) de chaque élève à partir de sa VMA personnelle.
//
// Échauffement commun : 8 min (non chronométré en %VMA, l'appli ne guide pas l'échauffement).
// Retour au calme commun : 5 min à 57% VMA (milieu de la fourchette 55-60% demandée),
// encodé comme récupération finale de la structure.

function creerType(lettre, pctTravail, dureeTravailS, pctRecup, dureeRecupS) {
  return {
    id: crypto.randomUUID(),
    lettre,
    pct_vma_travail: pctTravail,
    duree_travail_s: dureeTravailS,
    pct_vma_recup: pctRecup,
    duree_recup_s: dureeRecupS
  }
}

function structure(types, sequence, nbTours = 1, recupSerie = null) {
  return {
    types,
    sequence,
    nbTours,
    guidage: 'minuteur',
    recupSerie: recupSerie || { active: false, duree_s: 120, pct_vma: 60 },
    recupFinale: { active: true, duree_s: 300, pct_vma: 57 }
  }
}

// Blocs successifs identiques (même %VMA, même durée), séparés par une récupération.
function blocsUniformes(pct, dureeS, repetitions, recupDureeS, recupPct = 60) {
  const a = creerType('A', pct, dureeS, recupPct, recupDureeS)
  return structure([a], [{ typeId: a.id, repetitions }], 1)
}

// Un seul bloc continu, sans récupération interne.
function blocContinu(pct, dureeS) {
  const a = creerType('A', pct, dureeS, 60, 0)
  return structure([a], [{ typeId: a.id, repetitions: 1 }], 1)
}

// Blocs successifs à %VMA différents (progressivité), même durée, même récupération.
function blocsProgressifs(pcts, dureeS, recupDureeS, recupPct = 60) {
  const types = pcts.map((p, i) => creerType(String.fromCharCode(65 + i), p, dureeS, recupPct, recupDureeS))
  const sequence = types.map((t) => ({ typeId: t.id, repetitions: 1 }))
  return structure(types, sequence, 1)
}

// Répétitions groupées en séries : récup courte entre répétitions, récup plus longue entre séries.
function seriesRepetitions(pctTravail, dureeTravailS, pctRecupRep, dureeRecupRepS, repsParSerie, nbSeries, recupSerieS = 0, pctRecupSerie = 55) {
  const a = creerType('A', pctTravail, dureeTravailS, pctRecupRep, dureeRecupRepS)
  const recupSerie = nbSeries > 1 ? { active: true, duree_s: recupSerieS, pct_vma: pctRecupSerie } : null
  return structure([a], [{ typeId: a.id, repetitions: repsParSerie }], nbSeries, recupSerie)
}

function niveau(nom, struct) {
  return {
    id: crypto.randomUUID(),
    nom,
    guidage: 'minuteur',
    visible: true,
    echauffement: { active: true, duree_s: 480 },
    blocs: [{ id: crypto.randomUUID(), mode: 'fullpower', structure: struct }]
  }
}

function seanceType(codeType, titre, regleParticuliere, niveaux) {
  return {
    id: crypto.randomUUID(),
    codeType,
    titre,
    regleParticuliere: regleParticuliere || null,
    dateCreation: Date.now(),
    niveauScolaire: 'seconde',
    ordre: 0,
    visible: false,
    classesVisibles: [],
    niveaux
  }
}

export function genererSeancesTypesSecondes() {
  return [
    seanceType('decouverte', "Découverte et prise de repères d'allure", null, [
      niveau('Facile', blocsUniformes(62, 480, 3, 120)),
      niveau('Moyen', blocsUniformes(68, 540, 3, 120)),
      niveau('Difficile', blocsUniformes(73, 600, 3, 90))
    ]),

    seanceType('regularite', "Régularité d'allure", null, [
      niveau('Facile', blocsUniformes(65, 600, 3, 120)),
      niveau('Moyen', blocsUniformes(68, 900, 2, 150)),
      niveau('Difficile', blocContinu(72, 1800))
    ]),

    seanceType('alternance', 'Alternance de rythme',
      'Niveau Difficile : 6 à 7 répétitions par série selon récupération.', [
      niveau('Facile', seriesRepetitions(75, 60, 55, 60, 3, 3, 120, 55)),
      niveau('Moyen', seriesRepetitions(80, 60, 55, 60, 4, 3, 120, 55)),
      niveau('Difficile', seriesRepetitions(82, 90, 55, 60, 6, 2, 120, 55))
    ]),

    seanceType('endurance', 'Endurance fondamentale',
      '1 pause possible dans la zone des 20 m du départ, durée < 1 min, autorisée toutes les 8 min de course.', [
      niveau('Facile', blocContinu(67, 1800)),
      niveau('Moyen', blocContinu(69, 1800)),
      niveau('Difficile', blocContinu(71, 1800))
    ]),

    seanceType('fractionne', 'Fractionné moyen', null, [
      niveau('Facile', seriesRepetitions(75, 180, 55, 120, 5, 1)),
      niveau('Moyen', seriesRepetitions(78, 180, 55, 90, 6, 1)),
      niveau('Difficile', seriesRepetitions(80, 240, 55, 90, 6, 1))
    ]),

    seanceType('progressivite', 'Progressivité', null, [
      niveau('Facile', blocsProgressifs([63, 65, 68, 70], 360, 105)),
      niveau('Moyen', blocsProgressifs([65, 68, 72, 75], 420, 105)),
      niveau('Difficile', blocsProgressifs([70, 75, 80], 480, 105))
    ]),

    seanceType('puissance3030', 'Puissance en 30/30', null, [
      niveau('Facile', seriesRepetitions(100, 30, 28, 30, 8, 3, 180, 28)),
      niveau('Moyen', seriesRepetitions(105, 30, 28, 30, 8, 3, 180, 28)),
      niveau('Difficile', seriesRepetitions(110, 30, 28, 30, 8, 3, 180, 28))
    ])
  ]
}
