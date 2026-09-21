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

// Transforme la structure (types + séquence + nb tours) en liste plate de phases,
// en résolvant les vitesses cibles à partir de la VMA de référence.
// Chaque phase de récupération est étiquetée (recupType) pour permettre l'annonce
// appropriée pendant la course : 'repetition' (entre deux répétitions d'un même passage),
// 'serie' (entre deux tours de la séquence) ou 'fin' (récupération/retour au calme final).
// inclureRecupFinale : à false pour le DERNIER bloc d'un niveau — la "Récupération / retour au
// calme final" de ce bloc sert alors uniquement à régler la durée de l'écran séance-level dédié
// (Recuperation.jsx, voir dureeRecuperationFinale ci-dessous), pour éviter de la jouer deux fois
// de suite (une fois dans ce bloc, une fois juste après).
export function expanserStructure(structure, vmaRef, { inclureRecupFinale = true } = {}) {
  const phases = []
  const vma = vmaRef || 15
  const nbTours = structure.nbTours || 1
  for (let tour = 0; tour < nbTours; tour++) {
    // Liste à plat des répétitions du tour, pour savoir si on est sur la toute dernière
    // (afin de ne pas cumuler la récup individuelle du type ET la récup de série qui suit).
    const instances = []
    structure.sequence.forEach((item) => {
      const type = structure.types.find((t) => t.id === item.typeId)
      if (!type) return
      for (let r = 0; r < item.repetitions; r++) instances.push(type)
    })
    const skipDerniereRecup = tour < nbTours - 1 && structure.recupSerie?.active
    instances.forEach((type, i) => {
      // serieIndex/serieTotal situent la phase dans le tour (série) en cours ; repIndex/repTotal
      // situent la répétition au sein de ce tour. Ces champs permettent à l'écran de course de
      // faire apparaître "Série X/N · Répétition Y/Z" et un décompte propre à chaque niveau,
      // plutôt qu'un seul décompte portant sur tout le bloc.
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
      const estDerniereInstanceDuTour = i === instances.length - 1
      if (type.duree_recup_s > 0 && !(estDerniereInstanceDuTour && skipDerniereRecup)) {
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

export function dureeTotaleStructure(structure, { inclureRecupFinale = true } = {}) {
  let total = 0
  const nbTours = structure.nbTours || 1
  for (let tour = 0; tour < nbTours; tour++) {
    const instances = []
    structure.sequence.forEach((item) => {
      const type = structure.types.find((t) => t.id === item.typeId)
      if (!type) return
      for (let r = 0; r < item.repetitions; r++) instances.push(type)
    })
    const skipDerniereRecup = tour < nbTours - 1 && structure.recupSerie?.active
    instances.forEach((type, i) => {
      const estDerniereInstanceDuTour = i === instances.length - 1
      total += type.duree_travail_s
      if (!(estDerniereInstanceDuTour && skipDerniereRecup)) total += type.duree_recup_s || 0
    })
    if (tour < nbTours - 1 && structure.recupSerie?.active) total += structure.recupSerie.duree_s
  }
  if (structure.recupFinale?.active && inclureRecupFinale) total += structure.recupFinale.duree_s
  return total
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
  if (p.recupType === 'serie') return 'Récupération type Série'
  if (p.recupType === 'fin') return 'Récupération Fin de séance'
  return 'Récupération type Répétition'
}

// Distance et durée totales d'un niveau (échauffement + récupération finale de séance inclus),
// pour l'aperçu avant de démarrer et pour les cartes de choix de niveau. La récupération finale
// du dernier bloc (si Full Power et active) n'est comptée qu'une fois, via dureeRecuperationFinale
// — voir plus haut — puisqu'elle n'est plus jouée dans le déroulé du bloc lui-même.
export function totauxNiveau(niveau, vmaRef, dureeRecupFixeDefaut) {
  let distance = 0
  let duree = niveau.echauffement?.active ? niveau.echauffement.duree_s : 0
  niveau.blocs.forEach((b, i) => {
    const dernier = i === niveau.blocs.length - 1
    if (b.mode === 'fullpower' && b.structure) {
      const opts = dernier ? { inclureRecupFinale: false } : undefined
      duree += dureeTotaleStructure(b.structure, opts)
      distance += distanceTotaleStructure(b.structure, vmaRef, opts)
    } else if (b.mode !== 'fullpower') {
      duree += b.duree_s
      distance += b.distance_m
    }
  })
  duree += dureeRecuperationFinale(niveau, dureeRecupFixeDefaut)
  return { distance, duree }
}
