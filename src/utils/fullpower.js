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
export function expanserStructure(structure, vmaRef) {
  const phases = []
  const vma = vmaRef || 15
  const nbTours = structure.nbTours || 1
  for (let tour = 0; tour < nbTours; tour++) {
    structure.sequence.forEach((item) => {
      const type = structure.types.find((t) => t.id === item.typeId)
      if (!type) return
      for (let r = 0; r < item.repetitions; r++) {
        phases.push({
          phase: 'travail',
          typeLettre: type.lettre,
          tourIndex: tour,
          duree_s: type.duree_travail_s,
          vitesse_kmh: Math.round((type.pct_vma_travail / 100) * vma * 100) / 100
        })
        if (type.duree_recup_s > 0) {
          phases.push({
            phase: 'recup',
            recupType: 'repetition',
            typeLettre: type.lettre,
            tourIndex: tour,
            duree_s: type.duree_recup_s,
            vitesse_kmh: Math.round((type.pct_vma_recup / 100) * vma * 100) / 100
          })
        }
      }
    })
    if (tour < nbTours - 1 && structure.recupSerie?.active) {
      phases.push({
        phase: 'recup',
        recupType: 'serie',
        tourIndex: tour,
        duree_s: structure.recupSerie.duree_s,
        vitesse_kmh: Math.round((structure.recupSerie.pct_vma / 100) * vma * 100) / 100
      })
    }
  }
  if (structure.recupFinale?.active) {
    phases.push({
      phase: 'recup',
      recupType: 'fin',
      tourIndex: nbTours - 1,
      duree_s: structure.recupFinale.duree_s,
      vitesse_kmh: Math.round((structure.recupFinale.pct_vma / 100) * vma * 100) / 100
    })
  }
  return phases
}

export function dureeTotaleStructure(structure) {
  let total = 0
  const nbTours = structure.nbTours || 1
  for (let tour = 0; tour < nbTours; tour++) {
    structure.sequence.forEach((item) => {
      const type = structure.types.find((t) => t.id === item.typeId)
      if (!type) return
      total += item.repetitions * (type.duree_travail_s + (type.duree_recup_s || 0))
    })
    if (tour < nbTours - 1 && structure.recupSerie?.active) total += structure.recupSerie.duree_s
  }
  if (structure.recupFinale?.active) total += structure.recupFinale.duree_s
  return total
}

export function distanceTotaleStructure(structure, vmaRef) {
  const phases = expanserStructure(structure, vmaRef)
  return Math.round(phases.reduce((acc, p) => acc + (p.vitesse_kmh / 3.6) * p.duree_s, 0))
}

// Libellé d'annonce affiché (et énoncé à voix haute) à chaque changement de phase pendant la course.
export function libellePhase(p) {
  if (!p) return ''
  if (p.phase === 'travail') return 'Départ !'
  if (p.recupType === 'serie') return 'Récupération type Série'
  if (p.recupType === 'fin') return 'Récupération Fin de séance'
  return 'Récupération type Répétition'
}

// Distance et durée totales d'un niveau (échauffement inclus s'il est activé), pour l'aperçu
// avant de démarrer et pour les cartes de choix de niveau.
export function totauxNiveau(niveau, vmaRef) {
  let distance = 0
  let duree = niveau.echauffement?.active ? niveau.echauffement.duree_s : 0
  niveau.blocs.forEach((b) => {
    if (b.mode === 'fullpower' && b.structure) {
      duree += dureeTotaleStructure(b.structure)
      distance += distanceTotaleStructure(b.structure, vmaRef)
    } else if (b.mode !== 'fullpower') {
      duree += b.duree_s
      distance += b.distance_m
    }
  })
  return { distance, duree }
}
