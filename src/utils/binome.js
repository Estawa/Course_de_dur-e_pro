// Mode "binôme" : un élève sans téléphone (B) court avec un partenaire (A) qui porte le
// téléphone. Le guidage se fait sur la VMA moyenne des deux ; à la fin de chaque bloc, les mêmes
// mesures (distance, durée, vitesse moyenne par phase) sont réévaluées contre les objectifs
// PERSONNELS de chacun (calculés sur sa propre VMA). La séance de B n'est validée d'office que si
// A et B ont tous les deux réussi toute la séance ; sinon elle est enregistrée "non validée" et
// c'est le professeur qui tranche depuis la fiche de suivi (Valider / Refuser).

// Écart de VMA maximal accepté entre les deux partenaires : au-delà, l'allure moyenne de guidage
// sortirait de la tolérance d'allure (±9%) de l'un des deux, et le binôme ne pourrait pas réussir.
export const ECART_VMA_MAX_BINOME = 1 // km/h

const TOLERANCE_ALLURE = 0.09 // ±9%, même tolérance que le guidage GPS (CourseRun)
const scoreRatio = (r, tolerance) => Math.max(0, 1 - Math.min(1, Math.abs(r - 1) / tolerance)) * 100

// Vérifie qu'un binôme est compatible et renvoie la VMA de guidage (moyenne des deux).
// { ok: true, vmaGuidage } ou { ok: false, raison }
export function verifierCompatibiliteBinome(vmaA, vmaB) {
  if (vmaA == null && vmaB == null) return { ok: true, vmaGuidage: null }
  if (vmaA == null) return { ok: false, raison: "Tu n'as pas encore de VMA enregistrée : vois avec ton professeur avant de courir en binôme." }
  if (vmaB == null) return { ok: false, raison: "Ton binôme n'a pas encore de VMA enregistrée : il doit voir son professeur avant de courir en binôme." }
  const ecart = Math.abs(vmaA - vmaB)
  if (ecart > ECART_VMA_MAX_BINOME + 1e-9) {
    return {
      ok: false,
      raison: `Vos VMA sont trop éloignées (${vmaA} et ${vmaB} km/h, écart maximal ${ECART_VMA_MAX_BINOME} km/h) : vous ne pourriez pas tenir chacun votre allure en courant ensemble. Choisis un autre binôme.`
    }
  }
  return { ok: true, vmaGuidage: Math.round(((vmaA + vmaB) / 2) * 100) / 100 }
}

// Réévalue le résultat mesuré d'un bloc (course guidée sur la VMA moyenne) contre les objectifs
// personnels d'un élève. `cible` = preparerBloc(bloc, niveau, vmaPerso) → { phases, distanceCible, dureeCible }.
export function reevaluerBloc(resultatCourse, cible) {
  const r = resultatCourse || {}
  const distanceCible = Math.round(cible.distanceCible || 0)
  const distance = r.distanceRealisee ?? 0
  const pctDistance = distanceCible ? Math.round(Math.min(100, (distance / distanceCible) * 100)) : null

  if (!r.viaGPS || !Array.isArray(r.vitessesPhases)) {
    // Sans GPS (mode bips, ou GPS indisponible) : l'allure moyenne se déduit de la distance
    // déclarée par l'élève rapportée à la distance cible sur le même temps de course.
    const ratio = distanceCible ? distance / distanceCible : null
    return {
      ...r,
      distanceCible,
      pctDistance,
      pctAllure: ratio != null ? Math.round(scoreRatio(ratio, 0.25)) : r.pctAllure ?? null,
      respectAllure: ratio != null ? Math.abs(ratio - 1) <= TOLERANCE_ALLURE : !!r.respectAllure,
      termine: !!r.finAutomatique || (distanceCible ? distance >= distanceCible * 0.95 : !!r.termine),
      pctRecup: null,
      pctRegularite: null
    }
  }

  const phases = cible.phases || []
  const ratio = (i, p) => {
    const v = r.vitessesPhases[i]
    return v != null && p.vitesse_kmh ? v / p.vitesse_kmh : null
  }
  const ratiosTravail = phases.map((p, i) => (p.phase === 'travail' ? ratio(i, p) : null)).filter((x) => x != null)
  const ratiosRecup = phases.map((p, i) => (p.phase === 'recup' ? ratio(i, p) : null)).filter((x) => x != null)

  const pctAllure = ratiosTravail.length
    ? Math.round(ratiosTravail.reduce((a, x) => a + scoreRatio(x, 0.25), 0) / ratiosTravail.length)
    : null
  const pctRecup = ratiosRecup.length
    ? Math.round(ratiosRecup.reduce((a, x) => a + scoreRatio(x, 0.35), 0) / ratiosRecup.length)
    : null
  let pctRegularite = null
  if (ratiosTravail.length >= 2) {
    const moy = ratiosTravail.reduce((a, b) => a + b, 0) / ratiosTravail.length
    const variance = ratiosTravail.reduce((a, x) => a + (x - moy) ** 2, 0) / ratiosTravail.length
    pctRegularite = Math.round(Math.max(0, 100 - Math.sqrt(variance) * 400))
  } else if (ratiosTravail.length === 1) {
    pctRegularite = 100
  }

  const travail = phases.filter((p) => p.phase === 'travail')
  const vitesseCible = travail.length ? travail.reduce((a, p) => a + p.vitesse_kmh, 0) / travail.length : 0
  const respectAllure = vitesseCible
    ? Math.abs((r.vitesseMoyenne || 0) - vitesseCible) / vitesseCible <= TOLERANCE_ALLURE
    : false
  const termine = !!r.finAutomatique || distance >= distanceCible * 0.95

  return {
    ...r,
    distanceCible,
    vitesseCible: Math.round(vitesseCible * 10) / 10,
    termine,
    respectAllure,
    pctDistance,
    pctAllure,
    pctRecup,
    pctRegularite
  }
}

// Une séance est "réussie" (au sens du binôme) si chaque bloc est terminé ET à la bonne allure
// selon les objectifs personnels, et — pour l'élève sans téléphone — s'il n'a décroché d'aucun bloc.
export function seanceReussie(blocsResultats) {
  if (!blocsResultats || !blocsResultats.length) return false
  return blocsResultats.every((b) => b.termine && b.respectAllure && b.binomePresent !== false)
}

export const STATUTS_BINOME = {
  valide: 'Validée (réussie par les deux)',
  non_valide: 'Non validée · à décider',
  valide_prof: 'Validée par le professeur',
  refuse: 'Refusée par le professeur'
}

// Une séance réalisée en binôme par l'élève sans téléphone ne compte dans le cycle que si elle
// est validée (automatiquement ou par le professeur).
export function binomeCompte(r) {
  if (r?.binome?.role !== 'sansTelephone') return true
  return r.binome.statut === 'valide' || r.binome.statut === 'valide_prof'
}

export function nomCourt(e) {
  return e ? `${e.prenom} ${e.nom}` : ''
}
