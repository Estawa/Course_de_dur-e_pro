export function formatDuree(totalSec) {
  const s = Math.round(totalSec)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}h${String(m).padStart(2, '0')}min${String(sec).padStart(2, '0')}`
  return `${m}min${String(sec).padStart(2, '0')}`
}

export function vitesseVersAllure(kmh) {
  if (!kmh) return '--'
  const secParKm = 3600 / kmh
  const m = Math.floor(secParKm / 60)
  const s = Math.round(secParKm % 60)
  return `${m}'${String(s).padStart(2, '0')}"/km`
}

// Détermine la vitesse cible (km/h) d'un niveau : soit directement renseignée,
// soit déduite d'un %VMA si une VMA de référence est fournie.
export function vitesseCible(niveau, vmaRef) {
  if (niveau.mode === 'allure') return niveau.allure_kmh
  if (niveau.mode === 'pourcentVma' && vmaRef) return (niveau.pourcent_vma / 100) * vmaRef
  return niveau.allure_kmh || 0
}

// Note d'un bloc selon le choix de réussite déclaré par l'élève.
export function noteBloc(reussite) {
  if (reussite === 'reussi') return 20
  if (reussite === 'partiel') return 14
  return 8
}

// Note de la séance = moyenne des notes de blocs, arrondie au demi-point.
export function calculerNoteSeance(blocsResultats) {
  if (!blocsResultats.length) return 0
  const total = blocsResultats.reduce((acc, b) => acc + noteBloc(b.reussite), 0)
  return Math.round((total / blocsResultats.length) * 2) / 2
}

// Un bloc dispose de données GPS exploitables si le guidage était GPS
// et qu'une vitesse a effectivement été mesurée (permission accordée, position captée).
export function blocAvecGps(bloc) {
  return bloc.guidage === 'gps' && !!bloc.vitesseMoyenne && bloc.vitesseMoyenne > 0 && !!bloc.vitesseCible
}

// Note "réelle" d'un bloc à partir de l'écart mesuré par GPS entre l'allure prévue et l'allure réalisée.
export function noteBlocGPS(bloc) {
  if (!bloc.vitesseCible) return null
  const ecart = Math.abs(bloc.vitesseMoyenne - bloc.vitesseCible) / bloc.vitesseCible
  let note = 5
  if (ecart <= 0.05) note = 20
  else if (ecart <= 0.09) note = 17
  else if (ecart <= 0.15) note = 13
  else if (ecart <= 0.25) note = 9
  if (!bloc.termine) note = Math.min(note, 10)
  return note
}

// Note "réelle" de la séance, tenant compte du décalage effectif entre prévu et réalisé :
// mesuré objectivement par GPS quand les données sont disponibles, sinon basé sur la
// déclaration de l'élève (seule donnée observable sans GPS).
export function calculerNoteReelle(blocsResultats) {
  if (!blocsResultats || !blocsResultats.length) return { note: 0, avecGps: false }
  let somme = 0
  let tousAvecGps = true
  blocsResultats.forEach((b) => {
    if (blocAvecGps(b)) {
      somme += noteBlocGPS(b)
    } else {
      tousAvecGps = false
      somme += noteBloc(b.reussite)
    }
  })
  const note = Math.round((somme / blocsResultats.length) * 2) / 2
  return { note, avecGps: tousAvecGps }
}

export function syntheseCycle(realisationsEleve) {
  if (!realisationsEleve.length) return null
  const notes = realisationsEleve.map((r) => r.note)
  const moyenne = notes.reduce((a, b) => a + b, 0) / notes.length
  const tousLesBlocs = realisationsEleve.flatMap((r) => r.blocsResultats || [])
  const nbBlocsReussis = tousLesBlocs.filter((b) => b.reussite === 'reussi').length
  const progression = notes.length > 1 ? notes[notes.length - 1] - notes[0] : 0
  return {
    nbSeances: realisationsEleve.length,
    moyenne: Math.round(moyenne * 10) / 10,
    nbBlocsReussis,
    nbBlocsTotal: tousLesBlocs.length,
    progression: Math.round(progression * 10) / 10
  }
}
