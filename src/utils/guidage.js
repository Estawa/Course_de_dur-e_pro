// Guidage de l'allure et saisie de la distance par l'élève.
//
// Trois modes de guidage (réglage par défaut dans l'espace de chaque professeur, modifiable
// séance par séance) :
//   - 'gps'   : guidage par la vitesse GPS (encart de couleur + flèches + bips de régulation) ;
//   - 'bips'  : un bip à chaque plot (tous les 50 m), au rythme de l'allure cible, sans GPS ;
//   - 'mixte' : les bips donnent l'allure, le GPS mesure la distance en arrière-plan (jamais
//               affiché pendant la course).
// Dans tous les cas, l'élève calcule et saisit lui-même la distance réalisée (km + m) ; la mesure
// GPS ne lui est montrée qu'au bilan, pour comparaison.
//
// Retour au départ : une récupération assez longue (≥ 2 min par défaut) n'est plus courue sur
// place : l'élève revient à la ligne de départ pendant ce temps (décompte affiché en grand), y
// saisit la distance de la partie qu'il vient de courir, et repart de la ligne. Le bloc est donc
// découpé en "segments" de course séparés par ces récupérations de retour.

export const MODES_GUIDAGE = {
  gps: 'GPS seul',
  bips: 'Bips tous les 50 m',
  mixte: 'Mixte (bips + GPS en arrière-plan)'
}
export const MODE_GUIDAGE_DEFAUT = 'mixte'

export const SEUIL_RETOUR_DEPART_S = 120 // récup ≥ 2 min → retour au départ (réglage "auto")
export const OPTIONS_RETOUR_DEPART = {
  auto: 'Automatique (récup de 2 min ou plus)',
  toujours: 'À chaque récupération',
  jamais: 'Jamais (récup courue sur place)'
}

// Tolérances du contrôle GPS de la distance déclarée : alerte au-delà de ±5 % ET d'au moins 50 m.
export const ALERTE_ECART_PCT = 0.05
export const ALERTE_ECART_M = 50

// Plage de vitesse moyenne jugée plausible pour la distance déclarée (km/h).
export const VITESSE_PLAUSIBLE_MIN = 3
export const VITESSE_PLAUSIBLE_MAX = 24

export const PLOT_M = 50
export const TOUR_M = 400

export function resoudreModeGuidage(modeSeance, modeDefaut) {
  if (modeSeance && modeSeance !== 'defaut' && MODES_GUIDAGE[modeSeance]) return modeSeance
  return MODES_GUIDAGE[modeDefaut] ? modeDefaut : MODE_GUIDAGE_DEFAUT
}

export function temps50mS(vitesseKmh) {
  if (!vitesseKmh || vitesseKmh <= 0) return null
  return PLOT_M / (vitesseKmh / 3.6)
}

export function formatKmM(m) {
  if (m == null || isNaN(m)) return '—'
  const total = Math.round(m)
  const km = Math.floor(total / 1000)
  const reste = total % 1000
  return km > 0 ? `${km} km ${reste} m` : `${reste} m`
}

function recupEstRetour(p, option) {
  if (p.phase !== 'recup') return false
  if (option === 'jamais') return false
  if (option === 'toujours') return true
  return (p.duree_s || 0) >= SEUIL_RETOUR_DEPART_S
}

// Découpe la liste de phases d'un bloc en segments de course séparés par les récupérations de
// retour au départ.
// → { segments: [{ phases }], retours: [{ duree_s }] } avec retours.length = segments.length - 1
export function decouperSegments(phases, optionRetour = 'auto') {
  const segments = [{ phases: [] }]
  const retours = []
  // Les récupérations situées après la dernière phase de travail (récup de fin, retour au calme)
  // ne sont jamais des retours au départ : elles restent dans le dernier segment.
  let dernierTravail = -1
  phases.forEach((p, i) => { if (p.phase === 'travail') dernierTravail = i })
  phases.forEach((p, i) => {
    const courant = segments[segments.length - 1]
    if (i < dernierTravail && courant.phases.length > 0 && recupEstRetour(p, optionRetour)) {
      retours.push({ duree_s: p.duree_s })
      segments.push({ phases: [] })
    } else {
      courant.phases.push(p)
    }
  })
  return { segments, retours }
}

export function distancePhases(phases) {
  return Math.round(phases.reduce((acc, p) => acc + ((p.vitesse_kmh || 0) / 3.6) * (p.duree_s || 0), 0))
}

export function dureePhases(phases) {
  return phases.reduce((acc, p) => acc + (p.duree_s || 0), 0)
}

// Distance théorique (m) parcourue au temps t (s) en suivant exactement les allures cibles des
// phases — sert à caler les bips sur les plots.
export function distanceTheorique(phases, t) {
  let d = 0
  let reste = t
  for (const p of phases) {
    const dp = Math.min(reste, p.duree_s || 0)
    d += ((p.vitesse_kmh || 0) / 3.6) * dp
    reste -= dp
    if (reste <= 0) break
  }
  return d
}

// Contrôle de cohérence de la distance déclarée au regard du temps de course.
export function distancePlausible(distanceM, dureeS) {
  if (!dureeS || dureeS <= 0) return distanceM >= 0
  const v = (distanceM / dureeS) * 3.6
  return v >= VITESSE_PLAUSIBLE_MIN && v <= VITESSE_PLAUSIBLE_MAX
}

// Distance retenue pour la note : la distance déclarée fait foi, sauf si elle s'écarte de la
// mesure GPS de plus de 5 % ET d'au moins 50 m → la mesure GPS est retenue et le professeur est
// alerté (il peut ensuite choisir de retenir la distance déclarée).
export function resoudreDistance(distanceDeclaree, distanceGPS) {
  if (distanceGPS == null) {
    return { distanceRealisee: distanceDeclaree, sourceDistance: 'declaree', alerteDistance: false, ecartDistanceM: null }
  }
  const ecart = distanceDeclaree - distanceGPS
  const alerte = Math.abs(ecart) > ALERTE_ECART_M && distanceGPS > 0 && Math.abs(ecart) / distanceGPS > ALERTE_ECART_PCT
  return {
    distanceRealisee: alerte ? distanceGPS : distanceDeclaree,
    sourceDistance: alerte ? 'gps' : 'declaree',
    alerteDistance: alerte,
    ecartDistanceM: Math.round(ecart)
  }
}

// Fusionne les résultats des segments d'un bloc (dans l'ordre) en un seul résultat de bloc.
// segmentsResultats[i] = résultat de CourseRun + distanceDeclaree ; segments = decouperSegments().
export function fusionnerSegments(segmentsResultats, segments) {
  const viaGPS = segmentsResultats.every((s) => s.viaGPS)
  const distanceDeclaree = segmentsResultats.reduce((a, s) => a + (s.distanceDeclaree || 0), 0)
  const distanceGPS = viaGPS ? segmentsResultats.reduce((a, s) => a + (s.distanceGPS || 0), 0) : null
  const phasesCourues = segments.flatMap((s) => s.phases)
  const vitessesPhases = viaGPS ? segmentsResultats.flatMap((s, i) => s.vitessesPhases || segments[i].phases.map(() => null)) : null

  let vitesseMoyenne = null
  if (viaGPS && vitessesPhases) {
    let somme = 0
    let duree = 0
    phasesCourues.forEach((p, i) => {
      if (p.phase === 'travail' && vitessesPhases[i] != null) {
        somme += vitessesPhases[i] * p.duree_s
        duree += p.duree_s
      }
    })
    vitesseMoyenne = duree ? Math.round((somme / duree) * 10) / 10 : 0
  }

  const pausesParPhase = {}
  let offset = 0
  segmentsResultats.forEach((s, i) => {
    Object.entries(s.pausesParPhase || {}).forEach(([k, v]) => {
      pausesParPhase[Number(k) + offset] = v
    })
    offset += segments[i].phases.length
  })

  return {
    viaGPS,
    modeGuidage: segmentsResultats[segmentsResultats.length - 1]?.modeGuidage,
    distanceDeclaree,
    distanceGPS: distanceGPS != null ? Math.round(distanceGPS) : null,
    ...resoudreDistance(distanceDeclaree, distanceGPS != null ? Math.round(distanceGPS) : null),
    dureeRealisee: Math.round(segmentsResultats.reduce((a, s) => a + (s.dureeRealisee || 0), 0)),
    vitesseMoyenne,
    vitessesPhases,
    finAutomatique: segmentsResultats.every((s) => s.finAutomatique),
    nbPauses: segmentsResultats.reduce((a, s) => a + (s.nbPauses || 0), 0),
    dureePauseS: segmentsResultats.reduce((a, s) => a + (s.dureePauseS || 0), 0),
    pausesParPhase,
    nbSegments: segments.length,
    segmentsDetail: segmentsResultats.map((s) => ({
      distanceDeclaree: s.distanceDeclaree,
      distanceGPS: s.viaGPS ? s.distanceGPS : null,
      dureeRealisee: s.dureeRealisee,
      tours: s.tours || 0
    }))
  }
}
