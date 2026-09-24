import { binomeCompte } from './binome'
import { BAREME } from './bareme'

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

// Temps de passage au 50m (repère "plots" sur la piste, un plot tous les 50m) pour une
// vitesse donnée — utile à l'élève sans téléphone qui veut chronométrer lui-même son allure
// entre deux plots plutôt que de suivre un GPS.
export function vitesseVersTemps50m(kmh) {
  if (!kmh) return '--'
  const vitesseMs = (kmh * 1000) / 3600
  const secPour50m = 50 / vitesseMs
  return `${secPour50m.toFixed(1)}s/50m`
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

// Note "réelle" d'un bloc (sur 20, avant pénalités de séance) : plafonnée par la distance/durée
// réellement parcourue (jamais plus que la moyenne si l'élève n'a fait que la moitié du chemin),
// puis par la qualité d'exécution (allure/régularité/récup), puis réduite des pénalités de pause
// propres à ce bloc. Jamais montrée à l'élève. Voir bareme.js pour le détail des poids.
export function noteBlocReelle(bloc, bareme = BAREME) {
  const c = criteresBloc(bloc)

  // 1) Plafond lié à la distance/durée réellement parcourue.
  const plafondDistance = c.distance != null ? (c.distance / 100) * 20 : 20

  // 2) Qualité d'exécution (hors distance), sur les seuls critères mesurables pour ce bloc.
  const poids = bareme.poidsQualiteBloc
  const dispo = Object.keys(poids).filter((cle) => c[cle] != null)
  const poidsTotal = dispo.reduce((acc, cle) => acc + poids[cle], 0)
  const qualite = poidsTotal
    ? (dispo.reduce((acc, cle) => acc + poids[cle] * c[cle], 0) / poidsTotal / 100) * 20
    : 20

  // 3) Note avant pénalités = la plus pénalisante des deux.
  let note = Math.min(plafondDistance, qualite)

  // 4) Pénalité de pauses (propre à ce bloc).
  const nbPauses = bloc.nbPauses || 0
  const pausesPenalisables = Math.max(0, nbPauses - bareme.pausesTolereesParBloc)
  const penalitePause = Math.min(bareme.plafondPenalitePauseBloc, pausesPenalisables * bareme.penalitePauseParUnite)

  return { note: Math.max(0, note - penalitePause), plafondDistance, qualite, penalitePause }
}

// Note "réelle" de la séance : moyenne des notes de bloc (voir noteBlocReelle), puis pénalités
// appliquées une seule fois pour l'ensemble de la séance (pouls manquants, Borg manquant,
// observation manquante), plafonnées globalement — voir bareme.js. Prend en paramètre l'objet
// complet de la réalisation (blocsResultats + poulsParPhase + borg + observationGenerale), pas
// seulement les blocs, pour pouvoir appliquer ces pénalités de séance. Le paramètre poulsParPhase
// est optionnel : quand il est absent (ex. saisie prof en mode "Sans téléphone", qui ne recueille
// jamais le pouls), aucune pénalité de pouls n'est appliquée plutôt que de pénaliser
// systématiquement un mode qui ne collecte pas cette donnée. Le barème utilisé est celui passé en
// second paramètre (typiquement storage.getBareme(), personnalisable côté enseignant), avec les
// valeurs par défaut de bareme.js en repli.
export function calculerNoteReelle(realisation, bareme = BAREME) {
  const blocsResultats = Array.isArray(realisation) ? realisation : realisation?.blocsResultats || []
  if (!blocsResultats.length) return { note: 0, avecGps: false }

  let somme = 0
  let tousAvecGps = true
  blocsResultats.forEach((b) => {
    somme += noteBlocReelle(b, bareme).note
    if (!blocAvecGps(b)) tousAvecGps = false
  })
  const moyenneBlocs = somme / blocsResultats.length

  // Pénalités de séance : ignorées si on a reçu un simple tableau de blocs (compatibilité avec
  // les appels historiques) plutôt que l'objet complet de la réalisation.
  let penaliteSeance = 0
  if (!Array.isArray(realisation) && realisation) {
    const pouls = realisation.poulsParPhase
    if (pouls) {
      ;['repos', 'avantTravail', 'apresTravail', 'final'].forEach((cle) => {
        if (pouls[cle] == null) penaliteSeance += bareme.penalitePoulsManquant
      })
    }
    if (realisation.borg == null) penaliteSeance += bareme.penaliteBorgManquant
    if (!realisation.observationGenerale || !String(realisation.observationGenerale).trim()) {
      penaliteSeance += bareme.penaliteObservationManquante
    }
  }
  penaliteSeance = Math.min(bareme.plafondPenaliteSeance, penaliteSeance)

  const note = Math.max(0, Math.round((moyenneBlocs - penaliteSeance) * 2) / 2)
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
// l'historique et peut toujours être consultée séance par séance. Un Run en direct (course libre
// sans objectif prescrit, sans note) n'entre jamais dans ce calcul non plus.
export function syntheseCycle(realisationsEleve) {
  // Une séance en binôme (élève sans téléphone) non validée ou refusée par le professeur ne
  // compte pas non plus (voir utils/binome.js).
  const comptees = realisationsEleve.filter((r) => !r.exclureCycle && !r.runDirect && binomeCompte(r))
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
