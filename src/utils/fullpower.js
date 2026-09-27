export function typeVide(lettre) {
  return {
    id: crypto.randomUUID(),
    lettre,
    pct_vma_travail: 90,
    duree_travail_s: 180,
    pct_vma_recup: 60,
    duree_recup_s: 90
  }
}

// Valeurs par défaut d'une récupération entre séries / de fin de séance (désactivées par défaut,
// pour rester compatible avec les structures déjà enregistrées qui n'ont pas ce champ).
export function recupVide(duree_s = 120, pct_vma = 50) {
  return { active: false, duree_s, pct_vma }
}

// Structure Full Power par défaut d'une nouvelle série : 1 type A, 1 répétition, 1 tour.
export function structureVide() {
  const a = typeVide('A')
  return { types: [a], sequence: [{ typeId: a.id, repetitions: 1 }], nbTours: 1, recupSerie: recupVide(120, 50), recupFinale: recupVide(120, 50) }
}

// Liste à plat des répétitions (types) composant UN tour de la série.
function instancesDuTour(structure) {
  const instances = []
  ;(structure.sequence || []).forEach((item) => {
    const type = structure.types.find((t) => t.id === item.typeId)
    if (!type) return
    for (let r = 0; r < (Number(item.repetitions) || 0); r++) instances.push(type)
  })
  return instances
}

// Règle d'enchaînement (v1.58.0) : la récupération propre au type n'est PAS jouée après
//   - la dernière répétition du DERNIER tour de la série : on enchaîne directement sur la
//     récupération entre les séries, ou sur la phase suivante (récupération de fin de séance) ;
//   - la dernière répétition d'un tour quand une "récupération entre les tours" est active :
//     c'est elle qui la remplace (pas de cumul des deux).
function recupDeRepetitionJouee(tour, nbTours, estDerniereDuTour, structure) {
  if (!estDerniereDuTour) return true
  if (tour === nbTours - 1) return false
  return !structure.recupSerie?.active
}

// Transforme la structure d'une série (types + répétitions + nb de tours) en liste plate de
// phases, en résolvant les vitesses cibles à partir de la VMA de référence.
// Chaque phase de récupération est étiquetée (recupType) pour l'annonce pendant la course :
// 'repetition' (entre deux répétitions), 'serie' (valeur historique = entre deux TOURS de la
// série) ou 'fin' (récupération après la série).
// serieIndex/serieTotal (noms historiques) désignent le TOUR en cours dans la série.
// inclureRecupFinale : la récupération "après la série" n'est plus jouée dans le déroulé de la
// série elle-même par SeanceRunner (écran dédié entre les séries, ou récupération de fin de
// séance pour la dernière) — voir SeanceRunner.preparerBloc.
export function expanserStructure(structure, vmaRef, { inclureRecupFinale = true } = {}) {
  const phases = []
  const vma = vmaRef || 15
  const nbTours = Math.max(1, Number(structure.nbTours) || 1)
  const instances = instancesDuTour(structure)
  for (let tour = 0; tour < nbTours; tour++) {
    instances.forEach((type, i) => {
      phases.push({
        phase: 'travail',
        typeLettre: type.lettre,
        tourIndex: tour,
        serieIndex: tour,
        serieTotal: nbTours,
        repIndex: i + 1,
        repTotal: instances.length,
        duree_s: type.duree_travail_s,
        vitesse_kmh: Math.round((type.pct_vma_travail / 100) * vma * 100) / 100
      })
      const derniere = i === instances.length - 1
      if (type.duree_recup_s > 0 && recupDeRepetitionJouee(tour, nbTours, derniere, structure)) {
        phases.push({
          phase: 'recup',
          recupType: 'repetition',
          typeLettre: type.lettre,
          tourIndex: tour,
          serieIndex: tour,
          serieTotal: nbTours,
          repIndex: i + 1,
          repTotal: instances.length,
          duree_s: type.duree_recup_s,
          vitesse_kmh: Math.round((type.pct_vma_recup / 100) * vma * 100) / 100
        })
      }
    })
    if (tour < nbTours - 1 && structure.recupSerie?.active) {
      phases.push({
        phase: 'recup',
        recupType: 'serie',
        tourIndex: tour,
        serieIndex: tour,
        serieTotal: nbTours,
        repIndex: null,
        repTotal: null,
        duree_s: structure.recupSerie.duree_s,
        vitesse_kmh: Math.round((structure.recupSerie.pct_vma / 100) * vma * 100) / 100
      })
    }
  }
  if (structure.recupFinale?.active && inclureRecupFinale) {
    phases.push({
      phase: 'recup',
      recupType: 'fin',
      tourIndex: nbTours - 1,
      serieIndex: nbTours - 1,
      serieTotal: nbTours,
      repIndex: null,
      repTotal: null,
      duree_s: structure.recupFinale.duree_s,
      vitesse_kmh: Math.round((structure.recupFinale.pct_vma / 100) * vma * 100) / 100
    })
  }
  return phases
}

export function dureeTotaleStructure(structure, opts) {
  return expanserStructure(structure, 15, opts).reduce((acc, p) => acc + (Number(p.duree_s) || 0), 0)
}

// Temps de travail effectif d'une série (phases d'effort uniquement, sans aucune récupération).
export function tempsTravailStructure(structure) {
  return expanserStructure(structure, 15, { inclureRecupFinale: false })
    .filter((p) => p.phase === 'travail')
    .reduce((acc, p) => acc + (Number(p.duree_s) || 0), 0)
}

export function distanceTotaleStructure(structure, vmaRef, opts) {
  const phases = expanserStructure(structure, vmaRef, opts)
  return Math.round(phases.reduce((acc, p) => acc + (p.vitesse_kmh / 3.6) * p.duree_s, 0))
}

// Durée de la récupération de fin de séance (écran séance-level dédié, Recuperation.jsx) : au
// lieu d'un réglage séparé (retiré en v1.52.0 car redondant), elle est dérivée directement de la
// "Récupération / retour au calme final" du DERNIER bloc du niveau, quand ce bloc est en mode
// Full Power et que cette récupération y est activée — un seul champ à régler, pas de doublon.
// Ce même bloc exclut alors cette phase de son propre déroulé (voir inclureRecupFinale ci-dessus)
// pour qu'elle ne soit jouée qu'une fois, sur l'écran dédié. Repli sur la durée fixe historique
// (phasesFixes.js) si le dernier bloc est en mode Simple ou n'a pas cette récupération active.
export function dureeRecuperationFinale(niveau, dureeFixeDefaut) {
  const dernierBloc = niveau?.blocs?.[niveau.blocs.length - 1]
  const recup = dernierBloc?.mode === 'fullpower' ? dernierBloc.structure?.recupFinale : null
  return recup?.active && recup.duree_s > 0 ? recup.duree_s : dureeFixeDefaut
}

// Un bloc doit-il exclure sa propre "Récupération / retour au calme final" de son déroulé (parce
// qu'elle est déjà représentée par l'écran séance-level dédié) ? Vrai uniquement pour le dernier
// bloc d'un niveau, actif, en mode Full Power — voir dureeRecuperationFinale ci-dessus.
export function estDernierBlocAvecRecupDelegue(niveau, blocId) {
  const dernierBloc = niveau?.blocs?.[niveau.blocs.length - 1]
  return !!dernierBloc && dernierBloc.id === blocId && dernierBloc.mode === 'fullpower' && !!dernierBloc.structure?.recupFinale?.active
}

// Libellé d'annonce affiché (et énoncé à voix haute) à chaque changement de phase pendant la course.
export function libellePhase(p) {
  if (!p) return ''
  if (p.phase === 'travail') return 'Départ !'
  if (p.recupType === 'serie') return 'Récupération entre les séries'
  if (p.recupType === 'fin') return 'Récupération entre les parties'
  return 'Récupération'
}

// Durée de la récupération jouée APRÈS une série qui n'est pas la dernière du niveau
// (écran "Récupération entre les séries", voir SeanceRunner) : réglage "Récupération après la
// série" de cette série (Full Power). 0 si non active ou série en mode Simple.
export function dureeRecupApresSerie(bloc) {
  const r = bloc?.mode === 'fullpower' ? bloc.structure?.recupFinale : null
  return r?.active && r.duree_s > 0 ? Number(r.duree_s) : 0
}

export function pctVmaRecupApresSerie(bloc) {
  return bloc?.structure?.recupFinale?.pct_vma ?? 50
}

// Temps de travail effectif d'un niveau (somme des efforts de toutes ses séries, sans
// échauffement ni récupérations).
export function tempsTravailNiveau(niveau) {
  return (niveau?.blocs || []).reduce((acc, b) => {
    if (b.mode === 'fullpower') return acc + (b.structure ? tempsTravailStructure(b.structure) : 0)
    return acc + (Number(b.duree_s) || 0)
  }, 0)
}

// Distance, durée totale et temps de travail d'un niveau (échauffement + récupérations entre les
// séries + récupération de fin de séance inclus dans la durée), pour l'éditeur, l'aperçu avant
// de démarrer et les cartes de choix de niveau.
export function totauxNiveau(niveau, vmaRef, dureeRecupFixeDefaut) {
  let distance = 0
  let duree = niveau.echauffement?.active ? Number(niveau.echauffement.duree_s) || 0 : 0
  const blocs = niveau.blocs || []
  blocs.forEach((b, i) => {
    const dernier = i === blocs.length - 1
    if (b.mode === 'fullpower') {
      if (!b.structure) return
      const opts = dernier ? { inclureRecupFinale: false } : undefined
      duree += dureeTotaleStructure(b.structure, opts)
      distance += distanceTotaleStructure(b.structure, vmaRef, opts)
    } else {
      duree += Number(b.duree_s) || 0
      distance += Number(b.distance_m) || 0
    }
  })
  duree += dureeRecuperationFinale(niveau, dureeRecupFixeDefaut)
  return { distance, duree, travail: tempsTravailNiveau(niveau) }
}
