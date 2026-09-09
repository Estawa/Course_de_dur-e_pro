import { useEffect, useRef, useState } from 'react'
import { Play, Square, TrendingDown, CheckCircle2, AlertTriangle } from 'lucide-react'
import { beepDepart, beepFin, beep, planifierBipRegulation } from '../utils/audio'
import { storage } from '../utils/storage'

const DUREE_PALIER = 60
const VITESSE_DEPART = 7
const INCREMENT = 0.5
// Tolérance sous la vitesse cible avant qu'un palier soit considéré comme non tenu (bruit GPS inclus).
const TOLERANCE_GPS = 0.08

function vitessePalier(p) {
  return Math.round((VITESSE_DEPART + (p - 1) * INCREMENT) * 100) / 100
}

function distanceRequisePalier(p) {
  return (vitessePalier(p) * 1000 * DUREE_PALIER) / 3600
}

function haversine(a, b) {
  const R = 6371000
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180
  const lat1 = (a.latitude * Math.PI) / 180
  const lat2 = (b.latitude * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export default function TestVamEval({ eleve, onRetour }) {
  const [phase, setPhase] = useState('attente') // attente | effort | resultat
  const [palier, setPalier] = useState(1)
  const [elapsed, setElapsed] = useState(0)
  const [distancePalier, setDistancePalier] = useState(0)
  const [vitesseInstant, setVitesseInstant] = useState(0)
  const [gpsOk, setGpsOk] = useState(null) // null = pas encore déterminé, true/false ensuite
  const [resultat, setResultat] = useState(null)
  const [enregistre, setEnregistre] = useState(false)

  const startRef = useRef(null)
  const intervalRef = useRef(null)
  const watchIdRef = useRef(null)
  const lastPosRef = useRef(null)
  const bipTimeoutRef = useRef(null)
  const arreteRef = useRef(false)

  const dernierPalierValideRef = useRef(0) // dernier palier pleinement tenu (vitesse validée par GPS)
  const distancePalierRef = useRef(0)

  useEffect(() => {
    distancePalierRef.current = distancePalier
  }, [distancePalier])

  // Chronomètre général
  useEffect(() => {
    if (phase !== 'effort') return
    intervalRef.current = setInterval(() => {
      setElapsed((Date.now() - startRef.current) / 1000)
    }, 100)
    return () => clearInterval(intervalRef.current)
  }, [phase])

  // Suivi GPS : démarré dès l'ouverture de l'écran (avant même le lancement du test), pour que
  // l'élève voie si son GPS est actif avant de partir courir, et pas seulement une fois lancé.
  useEffect(() => {
    if (phase === 'resultat') return
    if (!('geolocation' in navigator)) {
      setGpsOk(false)
      return
    }
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsOk(true)
        if (phase !== 'effort') return
        const { latitude, longitude, speed } = pos.coords
        const now = Date.now()
        if (lastPosRef.current) {
          const dt = (now - lastPosRef.current.time) / 1000
          if (dt > 0) {
            const d = haversine(lastPosRef.current, { latitude, longitude })
            const vInstant = speed != null && speed >= 0 ? speed : d / dt
            const vKmh = vInstant * 3.6
            // Sous 0,5 km/h, on considère qu'il s'agit de bruit GPS (dérive de position à l'arrêt)
            // plutôt qu'un déplacement réel, donc on affiche 0 au lieu d'une valeur résiduelle.
            const vAffichee = vKmh < 0.5 ? 0 : vKmh
            setDistancePalier((prev) => prev + d)
            setVitesseInstant(vAffichee)
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
  }, [phase])

  // Bips de régulation d'allure : aide l'élève à se caler sur la vitesse du palier
  useEffect(() => {
    if (phase !== 'effort' || gpsOk !== true) return
    const cible = vitessePalier(palier)
    const ecart = (vitesseInstant - cible) / cible
    bipTimeoutRef.current = planifierBipRegulation(ecart, () => {})
    return () => clearTimeout(bipTimeoutRef.current)
  }, [vitesseInstant, phase, gpsOk, palier])

  // Passage automatique au palier suivant toutes les 60s, avec vérification GPS de la distance
  // parcourue par rapport à la distance requise pour ce palier (empêche de valider un palier
  // sans avoir réellement couru à l'allure demandée).
  useEffect(() => {
    if (phase !== 'effort' || arreteRef.current) return
    if (elapsed < DUREE_PALIER) return

    if (gpsOk === true) {
      const requise = distanceRequisePalier(palier)
      if (distancePalierRef.current >= requise * (1 - TOLERANCE_GPS)) {
        // Palier tenu : validé, on enchaîne sur le suivant
        dernierPalierValideRef.current = palier
        beep({ freq: 740, duration: 0.1 })
        setPalier((p) => p + 1)
        setDistancePalier(0)
        setElapsed(0)
        startRef.current = Date.now()
      } else {
        // Allure réellement insuffisante sur ce palier (mesurée par GPS) : le test s'arrête ici.
        terminer(distancePalierRef.current, requise)
      }
    } else if (gpsOk === false) {
      // Pas de GPS disponible : on ne peut plus valider automatiquement, retour au mode déclaratif.
      beep({ freq: 740, duration: 0.1 })
      dernierPalierValideRef.current = palier
      setPalier((p) => p + 1)
      setDistancePalier(0)
      setElapsed(0)
      startRef.current = Date.now()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed, phase, gpsOk, palier])

  function demarrer() {
    beepDepart()
    startRef.current = Date.now()
    lastPosRef.current = null
    setDistancePalier(0)
    setPhase('effort')
  }

  function arreterManuel() {
    terminer(distancePalierRef.current, distanceRequisePalier(palier))
  }

  function terminer(distanceFaite, requise) {
    if (arreteRef.current) return
    arreteRef.current = true
    beepFin()
    clearInterval(intervalRef.current)
    if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current)
    clearTimeout(bipTimeoutRef.current)
    setPhase('resultat')

    const viaGPS = gpsOk === true
    let vma
    if (viaGPS) {
      // Interpolation sur la distance réellement parcourue dans le palier en cours (et non sur le
      // temps écoulé), pour que le résultat reflète l'allure vraiment tenue.
      const fraction = Math.min(1, requise > 0 ? distanceFaite / requise : 0)
      const base = palier > 1 ? vitessePalier(palier - 1) : 0
      vma = Math.round((base + INCREMENT * fraction) * 100) / 100
    } else {
      // Mode déclaratif (GPS indisponible) : palier atteint, non vérifié.
      vma = vitessePalier(dernierPalierValideRef.current || 1)
    }

    const detail = {
      palier,
      distanceDansPalier: Math.round(distanceFaite),
      distanceRequise: Math.round(requise),
      viaGPS
    }
    setResultat({ vma, viaGPS })
    storage.enregistrerResultatTest(eleve, vma, 'vameval', detail)
    setEnregistre(true)
  }

  if (phase === 'attente') {
    return (
      <div className="max-w-md mx-auto px-6 py-16 text-center">
        <h2 className="font-display text-2xl text-piste-900 mb-2">Test VAM-EVAL</h2>
        <p className="text-sm text-piste-600 mb-3">
          Cours en continu en suivant les bips, sans marcher. La vitesse augmente de 0,5 km/h toutes les minutes,
          départ à {VITESSE_DEPART} km/h.
        </p>
        <p className="text-xs text-piste-500 mb-5">
          Le GPS vérifie ta vitesse réelle : le test s'arrête automatiquement dès que tu ne tiens plus l'allure du palier.
        </p>

        <div
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 mb-8 text-sm font-medium ${
            gpsOk === true
              ? 'bg-piste-50 text-piste-700 border border-piste-300'
              : gpsOk === false
              ? 'bg-[#fbeeea] text-alerte border border-alerte/50'
              : 'bg-piste-50 text-piste-500 border border-piste-200'
          }`}
        >
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              gpsOk === true ? 'bg-piste-600' : gpsOk === false ? 'bg-alerte' : 'bg-piste-300 animate-pulse'
            }`}
          />
          {gpsOk === true && 'GPS actif'}
          {gpsOk === false && 'GPS inactif'}
          {gpsOk === null && 'Recherche du GPS…'}
        </div>
        {gpsOk === false && (
          <p className="text-xs text-alerte mb-6 -mt-4">
            Vérifie que la localisation est autorisée pour l'appli. Sans GPS, le résultat ne sera pas vérifié.
          </p>
        )}

        <button
          onClick={demarrer}
          className="w-24 h-24 mx-auto rounded-full bg-piste-800 hover:bg-piste-700 text-white flex items-center justify-center mb-6 active:scale-95 transition"
        >
          <Play size={32} fill="white" />
        </button>
        <button onClick={onRetour} className="text-xs text-piste-400 underline">Retour</button>
      </div>
    )
  }

  if (phase === 'effort') {
    const cible = vitessePalier(palier)
    const ecartPct = cible ? ((vitesseInstant - cible) / cible) * 100 : 0
    const dansLaZone = ecartPct > -TOLERANCE_GPS * 100

    return (
      <div className="max-w-md mx-auto px-6 py-10 text-center">
        <p className="text-xs uppercase tracking-wide text-piste-500 mb-1">Palier {palier} · cible {cible} km/h</p>
        <div className="font-display text-6xl text-piste-900 mb-2 tabular-nums">
          {Math.max(0, Math.round(DUREE_PALIER - elapsed))}
        </div>

        {gpsOk === true && (
          <div className={`rounded-2xl border-2 p-5 mb-6 transition-colors ${dansLaZone ? 'border-piste-400 bg-piste-50' : 'border-alerte/50 bg-[#fbeeea]'}`}>
            <div className="flex items-center justify-center gap-2 mb-1">
              {!dansLaZone && <TrendingDown className="text-alerte" size={20} />}
              {dansLaZone && <CheckCircle2 className="text-piste-600" size={20} />}
              <span className="font-display text-3xl text-piste-900 tabular-nums">{vitesseInstant.toFixed(1)} km/h</span>
            </div>
            <p className="text-xs text-piste-600">{Math.round(distancePalier)} / {Math.round(distanceRequisePalier(palier))} m sur ce palier</p>
          </div>
        )}
        {gpsOk === false && (
          <div className="rounded-2xl border-2 border-alerte/50 bg-[#fbeeea] p-4 mb-6 flex items-center gap-2 justify-center">
            <AlertTriangle className="text-alerte shrink-0" size={18} />
            <p className="text-xs text-piste-700 text-left">GPS indisponible : test non vérifié, à ta charge d'annoncer quand tu t'arrêtes.</p>
          </div>
        )}
        {gpsOk === null && (
          <p className="text-xs text-piste-500 mb-6">Recherche du signal GPS…</p>
        )}

        <button onClick={arreterManuel} className="flex items-center gap-2 mx-auto bg-alerte text-white px-5 py-3 rounded-xl">
          <Square size={16} fill="white" /> Je n'en peux plus
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto px-6 py-16 text-center">
      <h2 className="font-display text-2xl text-piste-900 mb-1">Résultat</h2>
      <p className="font-display text-4xl text-piste-900 mb-3">{resultat.vma} km/h</p>
      <p className="text-xs text-piste-500 mb-4">
        {resultat.viaGPS ? 'Allure vérifiée par GPS.' : 'Allure non vérifiée (GPS indisponible pendant le test).'}
      </p>
      {enregistre && (
        <p className="text-sm text-piste-600 mb-3">
          Résultat transmis. Il sera pris en compte s'il s'agit de ton meilleur test, sauf si ton professeur a fixé une autre valeur.
        </p>
      )}
      <button onClick={onRetour} className="text-xs text-piste-400 underline">Retour aux tests</button>
    </div>
  )
}
