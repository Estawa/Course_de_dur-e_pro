import { useEffect, useRef, useState } from 'react'
import { Square, TrendingDown, TrendingUp, CheckCircle2 } from 'lucide-react'
import { beepDepart, beepFin, planifierBipRegulation, gongTransition } from '../utils/audio'
import { formatDuree, vitesseVersAllure } from '../utils/calc'

const TOLERANCE_GPS = 0.09 // ±9%, même tolérance que Fractionné GPS Pro

export default function CourseRun({ phases, guidage, distanceCible, dureeCible, labelBloc, onTermineBloc, onAbandon }) {
  const [etat, setEtat] = useState('latence') // latence | course | fin
  const [compteALatence, setCompteALatence] = useState(4)
  const [elapsed, setElapsed] = useState(0)
  const [distance, setDistance] = useState(0)
  const [vitesseInstant, setVitesseInstant] = useState(0)

  const startRef = useRef(null)
  const watchIdRef = useRef(null)
  const lastPosRef = useRef(null)
  const bipTimeoutRef = useRef(null)
  const intervalRef = useRef(null)
  const vitessesTravailRef = useRef([])
  const dernierIndexPhaseRef = useRef(-1)
  const termineAutoRef = useRef(false)

  const cumul = phases.reduce((acc, p, i) => {
    acc.push((acc[i - 1] || 0) + p.duree_s)
    return acc
  }, [])
  const dureeTotalePhases = cumul[cumul.length - 1] || 0

  let indexPhase = phases.findIndex((_, i) => elapsed < cumul[i])
  if (indexPhase === -1) indexPhase = phases.length - 1
  const phaseCourante = phases[indexPhase] || phases[0]
  const debutPhase = indexPhase > 0 ? cumul[indexPhase - 1] : 0
  const phaseElapsed = Math.max(0, elapsed - debutPhase)
  const vitesseCible = phaseCourante?.vitesse_kmh || 0

  useEffect(() => {
    if (etat !== 'latence') return
    if (compteALatence <= 0) {
      beepDepart()
      setEtat('course')
      startRef.current = Date.now()
      return
    }
    const t = setTimeout(() => setCompteALatence((c) => c - 1), 800)
    return () => clearTimeout(t)
  }, [etat, compteALatence])

  useEffect(() => {
    if (etat !== 'course') return
    intervalRef.current = setInterval(() => {
      setElapsed((Date.now() - startRef.current) / 1000)
    }, 250)
    return () => clearInterval(intervalRef.current)
  }, [etat])

  // Gong à chaque changement de phase
  useEffect(() => {
    if (etat !== 'course') return
    if (dernierIndexPhaseRef.current !== -1 && indexPhase !== dernierIndexPhaseRef.current) {
      gongTransition()
    }
    dernierIndexPhaseRef.current = indexPhase
  }, [indexPhase, etat])

  // Fin automatique quand toutes les phases sont écoulées
  useEffect(() => {
    if (etat !== 'course' || termineAutoRef.current) return
    if (elapsed >= dureeTotalePhases) {
      termineAutoRef.current = true
      arreter(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed, etat])

  // Guidage GPS
  useEffect(() => {
    if (etat !== 'course' || guidage !== 'gps') return
    if (!('geolocation' in navigator)) return

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, speed } = pos.coords
        const now = Date.now()
        if (lastPosRef.current) {
          const dt = (now - lastPosRef.current.time) / 1000
          if (dt > 0) {
            const d = haversine(lastPosRef.current, { latitude, longitude })
            const vInstant = speed != null && speed >= 0 ? speed : d / dt
            setDistance((prev) => prev + d)
            setVitesseInstant(vInstant * 3.6)
            if (phaseCourante?.phase === 'travail') {
              vitessesTravailRef.current.push(vInstant * 3.6)
            }
          }
        }
        lastPosRef.current = { latitude, longitude, time: now }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 }
    )
    return () => {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current)
    }
  }, [etat, guidage])

  // Bips de régulation d'allure (mode GPS)
  useEffect(() => {
    if (etat !== 'course' || guidage !== 'gps' || !vitesseCible) return
    const ecart = (vitesseInstant - vitesseCible) / vitesseCible
    bipTimeoutRef.current = planifierBipRegulation(ecart, () => {})
    return () => clearTimeout(bipTimeoutRef.current)
  }, [vitesseInstant, etat, guidage, vitesseCible])

  function arreter(automatique = false) {
    beepFin()
    if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current)
    clearInterval(intervalRef.current)
    setEtat('fin')

    const dureeReelle = elapsed
    let termine, respectAllure

    if (guidage === 'gps') {
      termine = automatique || distance >= distanceCible * 0.95
      const vs = vitessesTravailRef.current
      const vitesseMoyenne = vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : 0
      const vitesseCibleMoyenneTravail =
        phases.filter((p) => p.phase === 'travail').reduce((a, p) => a + p.vitesse_kmh, 0) /
        (phases.filter((p) => p.phase === 'travail').length || 1)
      respectAllure = vitesseCibleMoyenneTravail
        ? Math.abs(vitesseMoyenne - vitesseCibleMoyenneTravail) / vitesseCibleMoyenneTravail <= TOLERANCE_GPS
        : false
      onTermineBloc({
        termine,
        respectAllure,
        distanceRealisee: Math.round(distance),
        dureeRealisee: dureeReelle,
        vitesseMoyenne: Math.round(vitesseMoyenne * 10) / 10
      })
    } else {
      termine = automatique || dureeReelle >= dureeCible * 0.9
      respectAllure = Math.abs(dureeReelle - dureeCible) / dureeCible <= 0.1
      onTermineBloc({ termine, respectAllure, distanceRealisee: distanceCible, dureeRealisee: dureeReelle, vitesseMoyenne: null })
    }
  }

  if (etat === 'latence') {
    return (
      <div className="max-w-md mx-auto px-6 py-24 text-center">
        <p className="text-piste-600 mb-4">Prépare-toi...</p>
        <div className="font-display text-7xl text-piste-900">{compteALatence}</div>
      </div>
    )
  }

  const ecartPct = vitesseCible ? ((vitesseInstant - vitesseCible) / vitesseCible) * 100 : 0
  const dansLaZone = Math.abs(ecartPct) < 5

  return (
    <div className="max-w-md mx-auto px-6 py-8 text-center">
      <p className="text-xs uppercase tracking-wide text-piste-500 mb-1">
        {labelBloc} {phases.length > 1 && `· Phase ${indexPhase + 1}/${phases.length}`}
      </p>
      <p className="text-[11px] uppercase tracking-wide font-medium text-piste-600 mb-3">
        {phaseCourante?.phase === 'recup' ? 'Récupération' : 'Travail'}{phaseCourante?.typeLettre ? ` · Type ${phaseCourante.typeLettre}` : ''}
      </p>
      <div className="font-display text-6xl text-piste-900 mb-2 tabular-nums">{formatDuree(phaseElapsed)}</div>
      <p className="text-sm text-piste-500 mb-8">Objectif phase {formatDuree(phaseCourante?.duree_s || 0)} · {vitesseVersAllure(vitesseCible)}</p>

      {guidage === 'gps' ? (
        <div className={`rounded-2xl border-2 p-6 mb-8 transition-colors ${dansLaZone ? 'border-piste-400 bg-piste-50' : 'border-alerte/50 bg-[#fbeeea]'}`}>
          <div className="flex items-center justify-center gap-2 mb-1">
            {ecartPct > 5 && <TrendingUp className="text-alerte" size={20} />}
            {ecartPct < -5 && <TrendingDown className="text-alerte" size={20} />}
            {dansLaZone && <CheckCircle2 className="text-piste-600" size={20} />}
            <span className="font-display text-3xl text-piste-900 tabular-nums">{vitesseInstant.toFixed(1)} km/h</span>
          </div>
          <p className="text-xs text-piste-600">{Math.round(distance)} m parcourus</p>
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-piste-300 bg-piste-50 p-6 mb-8">
          <p className="font-display text-3xl text-piste-900 mb-1">{formatDuree(dureeTotalePhases - elapsed)}</p>
          <p className="text-xs text-piste-600">temps restant sur ce bloc</p>
        </div>
      )}

      <button
        onClick={() => arreter(false)}
        className="w-full flex items-center justify-center gap-2 bg-alerte hover:bg-alerte/90 text-white font-medium py-4 rounded-xl transition active:scale-[0.98]"
      >
        <Square size={16} fill="white" /> Terminer le bloc
      </button>
      <button onClick={onAbandon} className="mt-3 text-xs text-piste-400 underline">
        Abandonner sans enregistrer
      </button>
    </div>
  )
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
