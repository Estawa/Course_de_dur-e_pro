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

// Un bloc dispose de données GPS exploitables si le GPS a effectivement été utilisé pendant le
// bloc (tenté automatiquement à chaque fois) et qu'une vitesse a été mesurée.
export function blocAvecGps(bloc) {
  return !!bloc.viaGPS && !!bloc.vitesseMoyenne && bloc.vitesseMoyenne > 0 && !!bloc.vitesseCible
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

// Note "réelle" d'un bloc sans GPS, à partir des deux critères mesurés objectivement par le
// minuteur : respect de l'allure/du temps de passage (respectAllure) et distance/durée totale
// effectivement parcourue (termine).
export function noteBlocSansGPS(bloc) {
  let note = 20
  if (!bloc.respectAllure) note -= 7
  if (!bloc.termine) note = Math.min(note, 10)
  return Math.max(0, note)
}

// Note "réelle" d'un bloc sur les deux critères retenus (allure, distance/durée totale) :
// via l'écart GPS quand mesurable, sinon via les mêmes critères évalués par minuteur.
export function noteBlocCritere(bloc) {
  return blocAvecGps(bloc) ? noteBlocGPS(bloc) : noteBlocSansGPS(bloc)
}

// % de réussite de la séance sur chacun des deux critères, tous blocs confondus.
export function pourcentagesReussite(blocsResultats) {
  if (!blocsResultats || !blocsResultats.length) return { allure: null, distanceDuree: null }
  const total = blocsResultats.length
  const nbAllure = blocsResultats.filter((b) => b.respectAllure).length
  const nbTermine = blocsResultats.filter((b) => b.termine).length
  return {
    allure: Math.round((nbAllure / total) * 100),
    distanceDuree: Math.round((nbTermine / total) * 100)
  }
}

// Pondération des 4 critères de la phase Travail. La somme n'a pas besoin de faire 100 : elle
// est renormalisée sur les seuls critères disponibles pour un bloc donné (ex. pas de récup pour
// une séance sans phase de récup Full Power).
const POIDS_CRITERES = { distance: 0.30, allure: 0.35, recup: 0.15, regularite: 0.20 }

// % de réussite des 4 critères d'un bloc, avec repli sur les 2 anciens critères (booléens) pour
// les réalisations enregistrées avant l'introduction de la notation fine par phase.
export function criteresBloc(bloc) {
  if (bloc.pctDistance != null || bloc.pctAllure != null) {
    return {
      distance: bloc.pctDistance ?? null,
      allure: bloc.pctAllure ?? null,
      recup: bloc.pctRecup ?? null,
      regularite: bloc.pctRegularite ?? null
    }
  }
  // Anciennes réalisations : seuls distance/allure sont déductibles, en tout ou rien.
  return {
    distance: bloc.termine ? 100 : 40,
    allure: bloc.respectAllure ? 100 : 40,
    recup: null,
    regularite: null
  }
}

// Moyenne des 4 critères d'un bloc (ou moins si certains sont indisponibles), pondérée, puis
// convertie en note sur 20.
export function noteBlocPondere(bloc) {
  const c = criteresBloc(bloc)
  const disponibles = Object.entries(c).filter(([, v]) => v != null)
  if (!disponibles.length) return 0
  const poidsTotal = disponibles.reduce((acc, [cle]) => acc + POIDS_CRITERES[cle], 0)
  const somme = disponibles.reduce((acc, [cle, v]) => acc + POIDS_CRITERES[cle] * v, 0)
  const pctGlobal = somme / poidsTotal
  return Math.round((pctGlobal / 100) * 20 * 2) / 2
}

// % de réussite global d'un bloc (moyenne pondérée des critères disponibles), pour la vue
// enseignant simplifiée et pour calculerNoteReelle.
export function pourcentageGlobalBloc(bloc) {
  const c = criteresBloc(bloc)
  const disponibles = Object.entries(c).filter(([, v]) => v != null)
  if (!disponibles.length) return 0
  const poidsTotal = disponibles.reduce((acc, [cle]) => acc + POIDS_CRITERES[cle], 0)
  const somme = disponibles.reduce((acc, [cle, v]) => acc + POIDS_CRITERES[cle] * v, 0)
  return Math.round(somme / poidsTotal)
}

// % de réussite moyen de la séance, critère par critère (vue élève détaillée). Un critère
// indisponible sur tous les blocs (ex. pas de récup Full Power) n'apparaît pas.
export function criteresSeance(blocsResultats) {
  if (!blocsResultats || !blocsResultats.length) return { distance: null, allure: null, recup: null, regularite: null }
  const cles = ['distance', 'allure', 'recup', 'regularite']
  const res = {}
  cles.forEach((cle) => {
    const valeurs = blocsResultats.map((b) => criteresBloc(b)[cle]).filter((v) => v != null)
    res[cle] = valeurs.length ? Math.round(valeurs.reduce((a, b) => a + b, 0) / valeurs.length) : null
  })
  return res
}

// % de réussite global de la séance (une seule valeur, vue enseignant simplifiée).
export function pourcentageGlobalSeance(blocsResultats) {
  if (!blocsResultats || !blocsResultats.length) return null
  const valeurs = blocsResultats.map(pourcentageGlobalBloc)
  return Math.round(valeurs.reduce((a, b) => a + b, 0) / valeurs.length)
}

// Note "réelle" de la séance, sur les 4 critères pondérés quand ils sont mesurables (GPS +
// structure Full Power), avec repli automatique sur les 2 anciens critères sinon.
export function calculerNoteReelle(blocsResultats) {
  if (!blocsResultats || !blocsResultats.length) return { note: 0, avecGps: false }
  let somme = 0
  let tousAvecGps = true
  blocsResultats.forEach((b) => {
    somme += noteBlocPondere(b)
    if (!blocAvecGps(b)) tousAvecGps = false
  })
  const note = Math.round((somme / blocsResultats.length) * 2) / 2
  return { note, avecGps: tousAvecGps }
}

// Note finale d'une séance = note réelle (ou déclarée à défaut), pondérée par l'ajustement
// comportement/attitude saisi par le prof (positif ou négatif), bornée entre 0 et 20.
export function noteFinale(realisation) {
  const base = realisation.noteReelle ?? realisation.note ?? 0
  const ajustement = realisation.ajustementComportement || 0
  return Math.max(0, Math.min(20, Math.round((base + ajustement) * 2) / 2))
}

// Une séance est visible pour une classe donnée si elle figure dans classesVisibles ; à défaut
// (anciennes séances sans ce champ), on retombe sur l'ancien booléen global "visible".
export function seanceVisiblePourClasse(seance, classe) {
  if (Array.isArray(seance.classesVisibles)) return seance.classesVisibles.includes(classe)
  return !!seance.visible
}

// Taux de réussite (%) d'une réalisation de séance, tous critères confondus — utilisé aussi
// bien pour la vue enseignant simplifiée que pour la courbe de tendance élève.
export function tauxReussiteRealisation(r) {
  return pourcentageGlobalSeance(r.blocsResultats)
}

// Une réalisation exclue (souci de santé avéré, contexte particulier...) ne compte plus dans la
// moyenne de cycle tant qu'elle n'est pas réactivée par le professeur, mais reste visible dans
// l'historique et peut toujours être consultée séance par séance.
export function syntheseCycle(realisationsEleve) {
  const comptees = realisationsEleve.filter((r) => !r.exclureCycle)
  if (!comptees.length) return null
  const notes = comptees.map((r) => noteFinale(r))
  const moyenne = notes.reduce((a, b) => a + b, 0) / notes.length
  const tousLesBlocs = comptees.flatMap((r) => r.blocsResultats || [])
  const nbBlocsReussis = tousLesBlocs.filter((b) => b.reussite === 'reussi').length
  const progression = notes.length > 1 ? notes[notes.length - 1] - notes[0] : 0
  return {
    nbSeances: comptees.length,
    nbSeancesExclues: realisationsEleve.length - comptees.length,
    moyenne: Math.round(moyenne * 10) / 10,
    nbBlocsReussis,
    nbBlocsTotal: tousLesBlocs.length,
    progression: Math.round(progression * 10) / 10
  }
}
