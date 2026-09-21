// Calculs du mode "Sans téléphone" : le prof saisit, pour chaque répétition (phase de travail)
// d'un bloc, la distance et le temps réellement réalisés par un élève sans GPS ni minuteur
// personnel. Reprend exactement la même tolérance et les mêmes formules de score que le guidage
// GPS (voir CourseRun.jsx / calculerCriteres4), pour que la note "réelle" du bloc soit cohérente
// avec celle d'un élève ayant réalisé sa séance en autonomie avec son téléphone.

const TOLERANCE_ALLURE = 0.09 // ±9%, même tolérance que le guidage GPS
const TOLERANCE_SCORE = 0.25 // même tolérance que le calcul pondéré des 4 critères

function scoreRatio(r, tolerance) {
  return Math.max(0, 1 - Math.min(1, Math.abs(r - 1) / tolerance)) * 100
}

function distanceCibleTotale(phasesTravail) {
  return Math.round(phasesTravail.reduce((acc, p) => acc + (p.vitesse_kmh / 3.6) * p.duree_s, 0))
}

function dureeCibleTotale(phasesTravail) {
  return phasesTravail.reduce((acc, p) => acc + p.duree_s, 0)
}

function vitesseCibleMoyenne(phasesTravail) {
  if (!phasesTravail.length) return null
  return Math.round((phasesTravail.reduce((a, p) => a + p.vitesse_kmh, 0) / phasesTravail.length) * 10) / 10
}

// Construit le résultat d'un bloc réalisé, à partir des répétitions saisies par le prof.
// phasesTravail : [{ duree_s, vitesse_kmh }] cibles, dans l'ordre. repetitions : [{ distanceM,
// dureeS }] saisies, même longueur/ordre.
export function construireResultatBlocSaisieProf(blocId, phasesTravail, repetitions) {
  const distanceCible = distanceCibleTotale(phasesTravail)
  const dureeCible = dureeCibleTotale(phasesTravail)
  const distanceRealisee = Math.round(repetitions.reduce((acc, r) => acc + (Number(r.distanceM) || 0), 0))
  const dureeRealisee = repetitions.reduce((acc, r) => acc + (Number(r.dureeS) || 0), 0)

  const ratios = phasesTravail
    .map((p, i) => {
      const r = repetitions[i]
      const d = Number(r?.distanceM) || 0
      const t = Number(r?.dureeS) || 0
      if (!t || !p.vitesse_kmh) return null
      return (d / t) * 3.6 / p.vitesse_kmh
    })
    .filter((r) => r != null)

  const pctAllure = ratios.length
    ? Math.round(ratios.reduce((acc, r) => acc + scoreRatio(r, TOLERANCE_SCORE), 0) / ratios.length)
    : null

  let pctRegularite = null
  if (ratios.length >= 2) {
    const moy = ratios.reduce((a, b) => a + b, 0) / ratios.length
    const variance = ratios.reduce((acc, r) => acc + (r - moy) ** 2, 0) / ratios.length
    pctRegularite = Math.round(Math.max(0, 100 - Math.sqrt(variance) * 400))
  } else if (ratios.length === 1) {
    pctRegularite = 100
  }

  const pctDistance = distanceCible ? Math.round(Math.min(100, (distanceRealisee / distanceCible) * 100)) : null

  const vCibleMoy = vitesseCibleMoyenne(phasesTravail)
  const vitesseMoyenne = dureeRealisee ? Math.round((distanceRealisee / dureeRealisee) * 3.6 * 10) / 10 : null
  const respectAllure =
    vitesseMoyenne != null && vCibleMoy
      ? Math.abs(vitesseMoyenne - vCibleMoy) / vCibleMoy <= TOLERANCE_ALLURE
      : false
  const termine = distanceCible ? distanceRealisee >= distanceCible * 0.95 : dureeRealisee >= dureeCible * 0.95

  let reussite = 'non_reussi'
  if (termine && respectAllure) reussite = 'reussi'
  else if (termine || respectAllure) reussite = 'partiel'

  return {
    blocId,
    viaGPS: false,
    saisieProf: true,
    nonRealise: false,
    termine,
    respectAllure,
    distanceRealisee,
    distanceCible,
    dureeRealisee,
    dureeCible,
    vitesseMoyenne,
    vitesseCible: vCibleMoy,
    pctDistance,
    pctAllure,
    pctRecup: null,
    pctRegularite,
    reussite,
    note: '',
    detailRepetitions: repetitions.map((r, i) => ({
      dureeCibleS: phasesTravail[i]?.duree_s ?? null,
      vitesseCibleKmh: phasesTravail[i]?.vitesse_kmh ?? null,
      distanceM: Number(r.distanceM) || 0,
      dureeS: Number(r.dureeS) || 0
    }))
  }
}

// Bloc marqué "non réalisé" par le prof (séance écourtée) : inclureDansNote détermine si ce
// bloc compte comme un échec dans le calcul de la note, ou s'il est exclu du calcul (comme s'il
// n'avait pas été prévu), au choix du prof cas par cas.
export function resultatBlocNonRealise(blocId, phasesTravail, inclureDansNote) {
  return {
    blocId,
    viaGPS: false,
    saisieProf: true,
    nonRealise: true,
    inclureDansNote: !!inclureDansNote,
    termine: false,
    respectAllure: false,
    distanceRealisee: 0,
    distanceCible: distanceCibleTotale(phasesTravail),
    dureeRealisee: 0,
    dureeCible: dureeCibleTotale(phasesTravail),
    vitesseMoyenne: null,
    vitesseCible: vitesseCibleMoyenne(phasesTravail),
    pctDistance: 0,
    pctAllure: 0,
    pctRecup: null,
    pctRegularite: null,
    reussite: 'non_reussi',
    note: '',
    detailRepetitions: []
  }
}

// Valeurs de départ pour la saisie d'un bloc : une répétition par phase de travail, pré-remplie
// à la valeur cible (le prof n'a plus qu'à corriger ce qui diffère du prévu).
export function repetitionsInitiales(phasesTravail) {
  return phasesTravail.map((p) => ({
    distanceM: Math.round((p.vitesse_kmh / 3.6) * p.duree_s),
    dureeS: p.duree_s
  }))
}
