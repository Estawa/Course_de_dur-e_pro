import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { LABEL_PHASE, COULEUR_PHASE } from '../utils/runDirect'

// Trace le trajet GPS d'un run direct sur une carte (fond OpenStreetMap), avec un tronçon de
// couleur différente par phase (Échauffement/Course/Récupération). Pas d'icône de marqueur
// image (évite le bug classique Leaflet + bundler) : départ/arrivée en simples cercles colorés.
export default function RunDirectCarte({ points }) {
  const conteneurRef = useRef(null)
  const carteRef = useRef(null)

  useEffect(() => {
    if (!conteneurRef.current || !points.length) return
    const carte = L.map(conteneurRef.current, { zoomControl: true, attributionControl: true })
    carteRef.current = carte
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19
    }).addTo(carte)

    // Découpe la trace en tronçons contigus de même phase, pour un tracé multicolore.
    const troncons = []
    let courant = null
    points.forEach((p) => {
      if (!courant || courant.phase !== p.phase) {
        courant = { phase: p.phase, pts: [] }
        troncons.push(courant)
      }
      courant.pts.push([p.lat, p.lng])
    })
    troncons.forEach((t, i) => {
      // Les tronçons se touchent : on répète le dernier point du précédent pour une ligne continue.
      const pts = i > 0 ? [troncons[i - 1].pts[troncons[i - 1].pts.length - 1], ...t.pts] : t.pts
      L.polyline(pts, { color: COULEUR_PHASE[t.phase] || '#1f4d40', weight: 4 }).addTo(carte)
    })

    const premier = points[0]
    const dernier = points[points.length - 1]
    L.circleMarker([premier.lat, premier.lng], { radius: 7, color: '#fff', weight: 2, fillColor: '#1f4d40', fillOpacity: 1 }).addTo(carte)
    L.circleMarker([dernier.lat, dernier.lng], { radius: 7, color: '#fff', weight: 2, fillColor: '#d85a30', fillOpacity: 1 }).addTo(carte)

    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]))
    carte.fitBounds(bounds, { padding: [24, 24] })

    return () => carte.remove()
  }, [points])

  const phasesPresentes = [...new Set(points.map((p) => p.phase))]

  if (!points.length) {
    return <p className="text-xs text-piste-500 text-center py-6">Aucune trace GPS enregistrée pour ce run.</p>
  }

  return (
    <div>
      <div ref={conteneurRef} style={{ height: 260, borderRadius: 16 }} className="mb-2" />
      <div className="flex items-center gap-3 flex-wrap justify-center">
        {phasesPresentes.map((phase) => (
          <span key={phase} className="flex items-center gap-1.5 text-[11px] text-piste-600">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COULEUR_PHASE[phase] }} />
            {LABEL_PHASE[phase]}
          </span>
        ))}
      </div>
    </div>
  )
}
