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

// Transforme la structure (types + séquence + nb tours) en liste plate de phases,
// en résolvant les vitesses cibles à partir de la VMA de référence.
export function expanserStructure(structure, vmaRef) {
  const phases = []
  const vma = vmaRef || 15
  for (let tour = 0; tour < structure.nbTours; tour++) {
    structure.sequence.forEach((item) => {
      const type = structure.types.find((t) => t.id === item.typeId)
      if (!type) return
      for (let r = 0; r < item.repetitions; r++) {
        phases.push({
          phase: 'travail',
          typeLettre: type.lettre,
          duree_s: type.duree_travail_s,
          vitesse_kmh: Math.round((type.pct_vma_travail / 100) * vma * 100) / 100
        })
        if (type.duree_recup_s > 0) {
          phases.push({
            phase: 'recup',
            typeLettre: type.lettre,
            duree_s: type.duree_recup_s,
            vitesse_kmh: Math.round((type.pct_vma_recup / 100) * vma * 100) / 100
          })
        }
      }
    })
  }
  return phases
}

export function dureeTotaleStructure(structure) {
  let total = 0
  for (let tour = 0; tour < structure.nbTours; tour++) {
    structure.sequence.forEach((item) => {
      const type = structure.types.find((t) => t.id === item.typeId)
      if (!type) return
      total += item.repetitions * (type.duree_travail_s + (type.duree_recup_s || 0))
    })
  }
  return total
}

export function distanceTotaleStructure(structure, vmaRef) {
  const phases = expanserStructure(structure, vmaRef)
  return Math.round(phases.reduce((acc, p) => acc + (p.vitesse_kmh / 3.6) * p.duree_s, 0))
}
