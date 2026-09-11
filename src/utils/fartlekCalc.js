// Paramètres et calcul de note de l'évaluation Fartlek sur piste (400m, zones intenses /
// récupération alternées matérialisées par des plots + zone de repos de 20m au départ).
// Voir la spécification complète validée avec le professeur pour le détail des règles.

export const NIVEAUX_FARTLEK = {
  Facile: { intenseM: 40, recupM: 160, pctIntense: 106.5, pctRecup: 65, dureeMinS: 20 * 60, plafond: 14 },
  Moyen: { intenseM: 50, recupM: 150, pctIntense: 110.5, pctRecup: 62.5, dureeMinS: 22 * 60, plafond: 17 },
  Difficile: { intenseM: 60, recupM: 140, pctIntense: 115, pctRecup: 60, dureeMinS: 25 * 60, plafond: 20 }
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
