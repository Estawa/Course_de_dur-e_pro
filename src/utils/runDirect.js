// Fonctions de calcul pour le Run en direct : suivi GPS continu multi-phases avec trace
// complète des points (pour la carte) et calculs post-course (vitesse max, meilleur km).

export function haversine(a, b) {
  const R = 6371000
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLon = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

// Vitesse maximale atteinte (km/h) sur l'ensemble des points enregistrés.
export function vitesseMax(points) {
  if (!points.length) return 0
  return Math.round(points.reduce((max, p) => Math.max(max, p.v), 0) * 10) / 10
}

// Vitesse moyenne (km/h) des points d'une phase donnée.
export function vitesseMoyennePhase(points, phase) {
  const pts = points.filter((p) => p.phase === phase)
  if (!pts.length) return 0
  return pts.reduce((a, p) => a + p.v, 0) / pts.length
}

// Temps (ms) du kilomètre le plus rapide parcouru pendant tout le run, par fenêtre glissante
// sur la trace de points (avec interpolation linéaire aux bornes pour plus de précision).
// Estimation basée sur les points GPS enregistrés (~1/seconde) : une valeur indicative, pas un
// chronométrage de précision.
export function meilleurKmMs(points) {
  if (points.length < 2) return null
  const cum = [0]
  for (let i = 1; i < points.length; i++) cum.push(cum[i - 1] + haversine(points[i - 1], points[i]))
  const total = cum[cum.length - 1]
  if (total < 1000) return null

  let meilleur = Infinity
  let j = 0
  for (let i = 1; i < points.length; i++) {
    while (j + 1 < i && cum[i] - cum[j + 1] >= 1000) j++
    if (cum[i] - cum[j] >= 1000) {
      const segDist = cum[j + 1] - cum[j]
      const segTime = points[j + 1].t - points[j].t
      const distManquante = cum[i] - 1000
      const frac = segDist > 0 ? Math.min(1, Math.max(0, (distManquante - cum[j]) / segDist)) : 0
      const tDebut = points[j].t + frac * segTime
      const duree = points[i].t - tDebut
      if (duree < meilleur) meilleur = duree
    }
  }
  return meilleur === Infinity ? null : meilleur
}

export function formatMinSec(ms) {
  if (ms == null) return '—'
  const totalSec = Math.round(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}'${String(s).padStart(2, '0')}"`
}

export const LABEL_PHASE = { echauffement: 'Échauffement', course: 'Course', recuperation: 'Récupération' }
export const COULEUR_PHASE = { echauffement: '#eda100', course: '#1f4d40', recuperation: '#378add' }

export function formatDistance(m) {
  if (m >= 1000) return `${(m / 1000).toFixed(2).replace('.', ',')} km`
  return `${Math.round(m)} m`
}
