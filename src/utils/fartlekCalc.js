// Paramètres et calcul de note de l'évaluation Fartlek sur piste (400m, zones intenses /
// récupération alternées matérialisées par des plots + zone de repos de 20m au départ).
// Voir la spécification complète validée avec le professeur pour le détail des règles.

// Zones identiques pour toute la classe (50 m intense / 150 m récup, deux fois par tour, en
// partant de la ligne de départ) : les niveaux se différencient par les %VMA à tenir dans chaque
// zone et par la durée de course effective minimale. Le plafond de note reste propre à chaque
// niveau (14/17/20). Guidage en mode mixte : bips à chaque plot au rythme de la zone en cours,
// GPS en arrière-plan pour contrôler la distance que l'élève calcule et saisit lui-même.
export const ZONES_TOUR = [
  { type: 'intense', m: 50 },
  { type: 'recup', m: 150 },
  { type: 'intense', m: 50 },
  { type: 'recup', m: 150 }
]

export const NIVEAUX_FARTLEK = {
  Facile: { intenseM: 50, recupM: 150, pctIntense: 106.5, pctRecup: 65, dureeMinS: 20 * 60, plafond: 14 },
  Moyen: { intenseM: 50, recupM: 150, pctIntense: 110.5, pctRecup: 62.5, dureeMinS: 22 * 60, plafond: 17 },
  Difficile: { intenseM: 50, recupM: 150, pctIntense: 115, pctRecup: 60, dureeMinS: 25 * 60, plafond: 20 }
}

// Position théorique (m depuis la ligne, sur un nombre quelconque de tours) après t secondes de
// course effective en tenant exactement les allures de chaque zone — sert à caler les bips.
export function distanceTheoriqueFartlek(niveauNom, vmaRef, t) {
  const cfg = NIVEAUX_FARTLEK[niveauNom]
  if (!cfg || !vmaRef || t <= 0) return 0
  const vitesse = (z) => ((z.type === 'intense' ? cfg.pctIntense : cfg.pctRecup) / 100) * vmaRef / 3.6
  const dureeTour = ZONES_TOUR.reduce((a, z) => a + z.m / vitesse(z), 0)
  const toursComplets = Math.floor(t / dureeTour)
  let reste = t - toursComplets * dureeTour
  let d = toursComplets * 400
  for (const z of ZONES_TOUR) {
    const dz = z.m / vitesse(z)
    if (reste >= dz) {
      d += z.m
      reste -= dz
    } else {
      d += reste * vitesse(z)
      break
    }
  }
  return d
}

// Zone (intense/récup) à une position donnée du tour.
export function zoneA(distanceM) {
  let p = ((distanceM % 400) + 400) % 400
  for (const z of ZONES_TOUR) {
    if (p < z.m) return z.type
    p -= z.m
  }
  return ZONES_TOUR[0].type
}

export const ZONE_REPOS_M = 20
export const TRANCHE_MALUS_S = 30

// Vitesse moyenne théorique (km/h) sur un tour de 400m à ce niveau, compte tenu du temps
// réellement passé en zone intense vs récupération (physiquement pondéré par la vitesse de
// chaque zone, pas juste une moyenne de %VMA).
export function vitesseMoyenneKmh(niveauNom, vmaRef) {
  const cfg = NIVEAUX_FARTLEK[niveauNom]
  if (!cfg || !vmaRef) return 0
  const vIntense = (cfg.pctIntense / 100) * vmaRef
  const vRecup = (cfg.pctRecup / 100) * vmaRef
  if (vIntense <= 0 || vRecup <= 0) return 0
  const tIntenseH = (cfg.intenseM / 1000) / vIntense
  const tRecupH = (cfg.recupM / 1000) / vRecup
  const tLapH = 2 * tIntenseH + 2 * tRecupH
  return tLapH > 0 ? 0.4 / tLapH : 0
}

export function distanceAttendueM(niveauNom, vmaRef, dureeEffectiveS) {
  const vMoy = vitesseMoyenneKmh(niveauNom, vmaRef)
  return (vMoy * 1000 / 3600) * dureeEffectiveS
}

// Note finale de l'évaluation. malusTotal = somme des -1 (immédiat + tranches de 30s)
// accumulés pendant les arrêts hors zone. Le bonus de dépassement est retourné à part,
// à titre indicatif : il n'autorise jamais à dépasser le plafond du niveau.
export function calculerNoteFartlek({ niveauNom, distanceReelleM, distanceAttendueM: attendue, malusTotal }) {
  const plafond = NIVEAUX_FARTLEK[niveauNom]?.plafond ?? 20
  const pct = attendue > 0 ? (distanceReelleM / attendue) * 100 : 0
  const bonus = pct > 100 ? Math.min(2, Math.floor((pct - 100) / 5)) : 0
  const noteBase = pct <= 100 ? 20 * (pct / 100) : 20 + bonus
  const noteApresMalus = noteBase - (malusTotal || 0)
  const noteFinale = Math.round(Math.max(0, Math.min(plafond, noteApresMalus)) * 2) / 2
  return {
    pctDistance: Math.round(pct),
    bonus,
    noteBase: Math.round(noteBase * 2) / 2,
    plafond,
    noteFinale
  }
}
