import { useEffect, useRef, useState } from 'react'

export function haversine(a, b) {
  const R = 6371000
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180
  const lat1 = (a.latitude * Math.PI) / 180
  const lat2 = (b.latitude * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

// Suivi GPS générique, sur le même principe que celui du test VAM-EVAL : démarre dès le
// montage de l'écran (avant même le lancement du test) et ne s'arrête/ne se réinitialise
// JAMAIS avant la fin du test — le flux de positions reste continu du début à la fin, y
// compris entre plusieurs répétitions ou paliers. La distance cumulée (distanceTotale) ne
// fait donc que croître ; pour mesurer la distance d'un segment précis (une répétition, un
// palier), on relève la distance totale au début et à la fin du segment via checkpoint() et
// on fait la différence — sans jamais couper le suivi, donc sans jamais perdre une mesure au
// moment d'un changement de phase.
export function useGpsSuivi() {
  const [gpsOk, setGpsOk] = useState(null)
  const [distanceTotale, setDistanceTotale] = useState(0)
  const [vitesseInstant, setVitesseInstant] = useState(0)
  const watchIdRef = useRef(null)
  const lastPosRef = useRef(null)
  const distanceTotaleRef = useRef(0) // toujours à jour, y compris dans une fermeture figée

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setGpsOk(false)
      return
    }
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsOk(true)
        const { latitude, longitude, speed } = pos.coords
        const now = Date.now()
        if (lastPosRef.current) {
          const dt = (now - lastPosRef.current.time) / 1000
          if (dt > 0) {
            const d = haversine(lastPosRef.current, { latitude, longitude })
            const vInstant = speed != null && speed >= 0 ? speed : d / dt
            const vKmh = vInstant * 3.6
            // Sous 0,5 km/h, on considère qu'il s'agit de bruit GPS (dérive de position à
            // l'arrêt) plutôt qu'un déplacement réel, donc on affiche 0 au lieu d'une valeur
            // résiduelle — mais on continue d'accumuler la distance normalement.
            setVitesseInstant(vKmh < 0.5 ? 0 : vKmh)
            distanceTotaleRef.current += d
            setDistanceTotale(distanceTotaleRef.current)
          }
        }
        lastPosRef.current = { latitude, longitude, time: now }
      },
      () => setGpsOk((prev) => (prev === true ? prev : false)),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 }
    )
    return () => {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current)
    }
  }, [])

  // Relevé de la distance totale cumulée à l'instant présent. Lit une ref (toujours à jour),
  // donc reste fiable même appelé depuis une fermeture figée (tick de setInterval créé plus tôt).
  function checkpoint() {
    return distanceTotaleRef.current
  }

  return { gpsOk, distanceTotale, vitesseInstant, checkpoint }
}
