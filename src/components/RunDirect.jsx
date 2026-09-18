import { useEffect, useRef, useState } from 'react'
import { Play, Pause, Square, ChevronRight } from 'lucide-react'
import { beepDepart, beepFin, gongTransition, annoncerVocal } from '../utils/audio'
import { formatDuree, vitesseVersAllure } from '../utils/calc'
import { useWakeLock } from '../utils/wakeLock'
import { storage } from '../utils/storage'
import IndicateurGps from './IndicateurGps'
import ReprisePrompt from './ReprisePrompt'
import { haversine, formatDistance, LABEL_PHASE, COULEUR_PHASE } from '../utils/runDirect'

const SEQUENCES = {
  complete: ['echauffement', 'course', 'recuperation'],
  immediate: ['course']
}
const TYPE_SESSION = 'run-direct'

function Stat({ label, valeur }) {
  return (
    <div>
      <p className="text-[11px] text-piste-500">{label}</p>
      <p className="text-base font-medium text-piste-900 tabular-nums">{valeur}</p>
    </div>
  )
}

// Run libre suivi en GPS continu, en une ou trois phases (Échauffement/Course/Récupération),
// avec pause/reprise et confirmation à chaque changement de phase. À la fin, transmet à App.jsx
// un résultat complet (trace GPS point par point + stats par phase) via onTermine.
//
// Reprise après fermeture/mise en veille prolongée de l'appli (même principe que la séance, les
// tests VMA et le Fartlek évaluatif) : la progression (phase, chrono, distances, échantillons de
// vitesse et trace GPS point par point) est sauvegardée en continu pendant le run, et proposée à
// la reprise via ReprisePrompt. Le chrono est calculé à partir d'horodatages réels (Date.now()),
// jamais par simple incrémentation d'intervalle, pour ne perdre aucun temps même après une
// fermeture complète de l'appli. Comme pour le Fartlek, une reprise relance toujours en pause :
// c'est à l'élève de taper "Reprendre" pour relancer le chrono, afin que la durée de la coupure
// ne soit jamais comptée comme du temps de course effectif.
export default function RunDirect({ eleve, vmaRef, onTermine, onAbandon, onActiviteEnCours }) {
  useWakeLock(true)

  const [repriseProposee, setRepriseProposee] = useState(() => (eleve ? storage.getSessionCours(eleve, TYPE_SESSION) : null))
  const [interne, setInterne] = useState('choix') // choix | latence | run
  const [mode, setMode] = useState(null)
  const [compteALatence, setCompteALatence] = useState(4)
  const [phaseIndex, setPhaseIndex] = useState(0)
  const [pause, setPause] = useState(false)
  const [distancePhase, setDistancePhase] = useState(0)
  const [distanceGlobal, setDistanceGlobal] = useState(0)
  const [vitesseInstant, setVitesseInstant] = useState(0)
  const [vitesseMoyennePhaseLive, setVitesseMoyennePhaseLive] = useState(0)
  const [gpsOk, setGpsOk] = useState(null)
  const [horloge, setHorloge] = useState(Date.now())
  const [confirmation, setConfirmation] = useState(null) // null | 'phaseSuivante' | 'finRun'
  const [annonce, setAnnonce] = useState(null)

  const sequence = mode ? SEQUENCES[mode] : []
  const phaseActuelle = sequence[phaseIndex]
  const dernierePhase = phaseIndex === sequence.length - 1
  const afficherTotaux = mode === 'complete' && phaseActuelle !== 'echauffement'

  const pauseRef = useRef(false)
  const phaseActuelleRef = useRef(phaseActuelle)
  const phaseDemarreeRef = useRef(false)
  const watchIdRef = useRef(null)
  const lastPosRef = useRef(null)
  const samplesPhaseRef = useRef([])
  const pointsRef = useRef([])
  const phasesStatsRef = useRef([])
  const annonceTimeoutRef = useRef(null)

  // Horodatages réels (jamais de simple compteur d'intervalle) : le chrono affiché se recalcule
  // à chaque tick de `horloge` à partir de ces repères, donc reste exact même après une coupure.
  const globalStartTsRef = useRef(null)
  const phaseStartTsRef = useRef(null)
  const pauseDebutRef = useRef(null) // timestamp de début de la pause en cours, ou null
  const totalPauseMsRef = useRef(0) // cumul du temps en pause depuis le DÉBUT DU RUN (jamais réinitialisé entre phases)
  const pauseAuDebutPhaseMsRef = useRef(0) // valeur de totalPauseMsRef au moment où la phase en cours a démarré

  // Miroirs en ref des valeurs utiles à la sauvegarde périodique, pour que celle-ci lise
  // toujours la valeur la plus fraîche même appelée depuis un intervalle à dépendances figées.
  const modeRef = useRef(mode)
  const phaseIndexRef = useRef(phaseIndex)
  const distancePhaseRef = useRef(0)
  const distanceGlobalRef = useRef(0)
  useEffect(() => { modeRef.current = mode }, [mode])
  useEffect(() => { phaseIndexRef.current = phaseIndex }, [phaseIndex])
  useEffect(() => { distancePhaseRef.current = distancePhase }, [distancePhase])
  useEffect(() => { distanceGlobalRef.current = distanceGlobal }, [distanceGlobal])
  useEffect(() => { pauseRef.current = pause }, [pause])
  useEffect(() => { phaseActuelleRef.current = phaseActuelle }, [phaseActuelle])
  useEffect(() => { onActiviteEnCours?.(interne === 'latence' || interne === 'run') }, [interne]) // eslint-disable-line react-hooks/exhaustive-deps

  // Horloge en direct : fait avancer l'affichage du chrono (recalculé à chaque tick, voir
  // calculerElapsed) et sert de base à la sauvegarde périodique.
  useEffect(() => {
    const iv = setInterval(() => setHorloge(Date.now()), 250)
    return () => clearInterval(iv)
  }, [])

  function calculerElapsed(now) {
    if (!globalStartTsRef.current) return { elapsedGlobalMs: 0, elapsedPhaseMs: 0 }
    const pauseEnCoursMs = pauseRef.current && pauseDebutRef.current ? now - pauseDebutRef.current : 0
    const elapsedGlobalMs = Math.max(0, now - globalStartTsRef.current - totalPauseMsRef.current - pauseEnCoursMs)
    const elapsedPhaseMs = Math.max(
      0,
      now - phaseStartTsRef.current - (totalPauseMsRef.current - pauseAuDebutPhaseMsRef.current) - pauseEnCoursMs
    )
    return { elapsedGlobalMs, elapsedPhaseMs }
  }

  function sauvegarderSession() {
    if (!eleve || !globalStartTsRef.current) return
    storage.sauvegarderSessionCours(eleve, TYPE_SESSION, {
      mode: modeRef.current,
      phaseIndex: phaseIndexRef.current,
      distancePhase: distancePhaseRef.current,
      distanceGlobal: distanceGlobalRef.current,
      samplesPhase: samplesPhaseRef.current,
      points: pointsRef.current,
      phasesStats: phasesStatsRef.current,
      globalStartTs: globalStartTsRef.current,
      phaseStartTs: phaseStartTsRef.current,
      totalPauseMs: totalPauseMsRef.current,
      pauseAuDebutPhaseMs: pauseAuDebutPhaseMsRef.current
    })
  }

  // Sauvegarde toutes les ~3s pendant le run, en plus de chaque changement d'état (pause,
  // changement de phase) — voir les appels explicites dans les fonctions concernées plus bas.
  useEffect(() => {
    if (interne !== 'run') return
    const iv = setInterval(sauvegarderSession, 3000)
    return () => clearInterval(iv)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interne])

  function handleReprendre() {
    const s = repriseProposee
    setMode(s.mode)
    setPhaseIndex(s.phaseIndex)
    setDistancePhase(s.distancePhase || 0)
    setDistanceGlobal(s.distanceGlobal || 0)
    samplesPhaseRef.current = s.samplesPhase || []
    pointsRef.current = s.points || []
    phasesStatsRef.current = s.phasesStats || []
    phaseDemarreeRef.current = true
    lastPosRef.current = null // évite un segment fantôme entre la position d'avant coupure et celle d'après
    globalStartTsRef.current = s.globalStartTs
    phaseStartTsRef.current = s.phaseStartTs
    totalPauseMsRef.current = s.totalPauseMs || 0
    pauseAuDebutPhaseMsRef.current = s.pauseAuDebutPhaseMs || 0
    // Reprise toujours en pause, comme le Fartlek évaluatif : la durée de la coupure (fermeture
    // ou mise en veille) est ainsi absorbée dans le temps de pause dès que l'élève tape
    // "Reprendre", sans jamais être comptée comme du temps de course effectif.
    pauseDebutRef.current = Date.now()
    setPause(true)
    setInterne('run')
    setRepriseProposee(null)
  }

  function handleIgnorerReprise() {
    if (eleve) storage.effacerSessionCours(eleve, TYPE_SESSION)
    setRepriseProposee(null)
  }

  // Décompte de départ (GPS déjà actif pendant ce temps, comme pour les séances de bibliothèque)
  useEffect(() => {
    if (interne !== 'latence') return
    if (compteALatence <= 0) {
      beepDepart()
      annoncerVocal(`Départ ${LABEL_PHASE[phaseActuelle]} !`)
      const now = Date.now()
      globalStartTsRef.current = now
      phaseStartTsRef.current = now
      totalPauseMsRef.current = 0
      pauseAuDebutPhaseMsRef.current = 0
      phaseDemarreeRef.current = true
      setInterne('run')
      return
    }
    const t = setTimeout(() => setCompteALatence((c) => c - 1), 800)
    return () => clearTimeout(t)
  }, [interne, compteALatence, phaseActuelle])

  // Recalcule l'allure moyenne de la phase à chaque nouvel échantillon
  useEffect(() => {
    const iv = setInterval(() => {
      const s = samplesPhaseRef.current
      setVitesseMoyennePhaseLive(s.length ? s.reduce((a, b) => a + b, 0) / s.length : 0)
    }, 1000)
    return () => clearInterval(iv)
  }, [])

  // GPS continu du début à la fin du run (jamais réinitialisé entre phases) : chaque point est
  // étiqueté avec la phase en cours au moment de la mesure, pour permettre la carte multicolore.
  useEffect(() => {
    if (interne === 'choix') return
    if (!('geolocation' in navigator)) { setGpsOk(false); return }
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsOk(true)
        const { latitude, longitude, speed } = pos.coords
        const now = Date.now()
        if (lastPosRef.current) {
          const dt = (now - lastPosRef.current.time) / 1000
          if (dt > 0) {
            const d = haversine(lastPosRef.current, { lat: latitude, lng: longitude })
            const vInstant = speed != null && speed >= 0 ? speed : d / dt
            const vKmh = vInstant * 3.6
            const vAffichee = vKmh < 0.5 ? 0 : vKmh
            setVitesseInstant(vAffichee)
            if (!pauseRef.current && phaseDemarreeRef.current) {
              setDistancePhase((x) => x + d)
              setDistanceGlobal((x) => x + d)
              samplesPhaseRef.current.push(vAffichee)
              pointsRef.current.push({ t: now, lat: latitude, lng: longitude, phase: phaseActuelleRef.current, v: Math.round(vAffichee * 10) / 10 })
            }
          }
        }
        lastPosRef.current = { lat: latitude, lng: longitude, time: now }
      },
      () => setGpsOk((prev) => (prev === true ? prev : false)),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 }
    )
    return () => { if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interne])

  function choisirMode(m) {
    setMode(m)
    setInterne('latence')
  }

  function togglePause() {
    const now = Date.now()
    if (!pause) {
      pauseDebutRef.current = now
      setPause(true)
    } else {
      if (pauseDebutRef.current) {
        totalPauseMsRef.current += now - pauseDebutRef.current
        pauseDebutRef.current = null
      }
      setPause(false)
    }
    sauvegarderSession()
  }

  function snapshotPhase() {
    const s = samplesPhaseRef.current
    const { elapsedPhaseMs } = calculerElapsed(Date.now())
    return {
      phase: phaseActuelle,
      dureeMs: elapsedPhaseMs,
      distanceM: Math.round(distancePhase),
      vitesseMoyenne: s.length ? Math.round((s.reduce((a, b) => a + b, 0) / s.length) * 10) / 10 : 0,
      pctVmaMoyen: vmaRef && s.length ? Math.round(((s.reduce((a, b) => a + b, 0) / s.length) / vmaRef) * 100) : null
    }
  }

  function confirmerPhaseSuivante() {
    phasesStatsRef.current.push(snapshotPhase())
    const now = Date.now()
    phaseStartTsRef.current = now
    pauseAuDebutPhaseMsRef.current = totalPauseMsRef.current
    setPhaseIndex((i) => i + 1)
    setDistancePhase(0)
    samplesPhaseRef.current = []
    setVitesseMoyennePhaseLive(0)
    setConfirmation(null)
    gongTransition()
    const prochaine = sequence[phaseIndex + 1]
    const texte = `Départ ${LABEL_PHASE[prochaine]} !`
    setAnnonce(texte)
    annoncerVocal(texte)
    clearTimeout(annonceTimeoutRef.current)
    annonceTimeoutRef.current = setTimeout(() => setAnnonce(null), 1800)
    sauvegarderSession()
  }

  function confirmerFinRun() {
    phasesStatsRef.current.push(snapshotPhase())
    beepFin()
    if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current)
    if (eleve) storage.effacerSessionCours(eleve, TYPE_SESSION)
    const { elapsedGlobalMs } = calculerElapsed(Date.now())
    onTermine({
      mode,
      dureeGlobaleMs: elapsedGlobalMs,
      distanceGlobaleM: Math.round(distanceGlobal),
      phases: phasesStatsRef.current,
      points: pointsRef.current
    })
  }

  function handleAnnulerChoix() {
    if (eleve) storage.effacerSessionCours(eleve, TYPE_SESSION)
    onAbandon?.()
  }

  // ---------- Écran de reprise (prioritaire sur tout le reste) ----------
  if (repriseProposee) {
    return <ReprisePrompt titre="Ton Run en direct" onReprendre={handleReprendre} onIgnorer={handleIgnorerReprise} />
  }

  // ---------- Écran 1 : choix du mode ----------
  if (interne === 'choix') {
    return (
      <div className="max-w-md mx-auto px-6 py-10">
        <h2 className="font-display text-2xl text-piste-900 mb-2 text-center">Run en direct</h2>
        <p className="text-sm text-piste-600 mb-8 text-center">Suivi GPS en continu, enregistré automatiquement dans ton historique.</p>
        <div className="space-y-3">
          <button
            onClick={() => choisirMode('complete')}
            className="w-full text-left bg-white border-2 border-piste-100 rounded-2xl p-5 hover:border-piste-300 transition flex items-center justify-between"
          >
            <div>
              <p className="font-display text-lg text-piste-900">Séance complète</p>
              <p className="text-xs text-piste-500 mt-0.5">Échauffement · Course · Récupération</p>
            </div>
            <ChevronRight size={18} className="text-piste-400 shrink-0" />
          </button>
          <button
            onClick={() => choisirMode('immediate')}
            className="w-full text-left bg-white border-2 border-piste-100 rounded-2xl p-5 hover:border-piste-300 transition flex items-center justify-between"
          >
            <div>
              <p className="font-display text-lg text-piste-900">Course immédiate</p>
              <p className="text-xs text-piste-500 mt-0.5">Juste la phase de course</p>
            </div>
            <ChevronRight size={18} className="text-piste-400 shrink-0" />
          </button>
        </div>
        <button onClick={handleAnnulerChoix} className="mt-8 text-xs text-piste-400 underline mx-auto block">Annuler</button>
      </div>
    )
  }

  // ---------- Écran 2 : décompte de départ ----------
  if (interne === 'latence') {
    return (
      <div className="max-w-md mx-auto px-6 py-24 text-center">
        <p className="text-piste-600 mb-4">Départ {LABEL_PHASE[phaseActuelle]}...</p>
        <div className="font-display text-7xl text-piste-900 mb-6">{compteALatence}</div>
        <IndicateurGps gpsOk={gpsOk} className="flex justify-center" />
      </div>
    )
  }

  // ---------- Écran 3 : run en cours ----------
  const { elapsedGlobalMs, elapsedPhaseMs } = calculerElapsed(horloge)
  const pctVmaPhase = vmaRef ? Math.round((vitesseMoyennePhaseLive / vmaRef) * 100) : null

  return (
    <div className="max-w-md mx-auto px-6 py-8">
      {annonce && (
        <div className="fixed inset-x-0 top-4 z-40 flex justify-center px-6 pointer-events-none">
          <div className="bg-piste-800 text-white text-sm font-semibold px-5 py-2.5 rounded-full shadow-lg text-center">{annonce}</div>
        </div>
      )}

      <div className="rounded-2xl border-2 p-5 mb-4" style={{ borderColor: COULEUR_PHASE[phaseActuelle], backgroundColor: `${COULEUR_PHASE[phaseActuelle]}0d` }}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs uppercase tracking-wide font-semibold" style={{ color: COULEUR_PHASE[phaseActuelle] }}>{LABEL_PHASE[phaseActuelle]}</p>
          <p className="text-sm text-piste-600 tabular-nums">{new Date(horloge).toLocaleTimeString('fr-FR')}</p>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-1 text-left">
          <Stat label="Temps de la phase" valeur={formatDuree(elapsedPhaseMs / 1000)} />
          <Stat label="Distance de la phase" valeur={formatDistance(distancePhase)} />
          <Stat label="Allure instantanée" valeur={`${vitesseInstant.toFixed(1)} km/h`} />
          <Stat label="Allure moyenne (phase)" valeur={`${vitesseMoyennePhaseLive.toFixed(1)} km/h`} />
          {vmaRef != null && <Stat label="%VMA moyen (phase)" valeur={`${pctVmaPhase}%`} />}
          <Stat label="Allure (min/km)" valeur={vitesseInstant ? vitesseVersAllure(vitesseInstant) : '—'} />
        </div>

        {afficherTotaux && (
          <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-piste-200/60 text-left">
            <Stat label="Temps de course total" valeur={formatDuree(elapsedGlobalMs / 1000)} />
            <Stat label="Distance totale" valeur={formatDistance(distanceGlobal)} />
          </div>
        )}
      </div>

      {gpsOk !== true && <IndicateurGps gpsOk={gpsOk} className="mb-4 flex justify-center" />}

      {confirmation === null && (
        <>
          <button
            onClick={togglePause}
            className="w-full flex items-center justify-center gap-2 border-2 border-piste-200 text-piste-800 font-medium py-3.5 rounded-xl transition active:scale-[0.98] mb-3"
          >
            {pause ? <Play size={16} /> : <Pause size={16} />} {pause ? 'Reprendre' : 'Pause'}
          </button>
          <button
            onClick={() => setConfirmation(dernierePhase ? 'finRun' : 'phaseSuivante')}
            className="w-full flex items-center justify-center gap-2 bg-piste-800 hover:bg-piste-700 text-white font-medium py-3.5 rounded-xl transition active:scale-[0.98]"
          >
            <Square size={16} fill="white" />
            {dernierePhase ? 'Fin de run' : `Stop et passage à ${sequence[phaseIndex + 1] === 'course' ? 'la course' : 'la récupération'}`}
          </button>
        </>
      )}

      {confirmation === 'phaseSuivante' && (
        <div className="rounded-xl border-2 border-piste-300 bg-piste-50 p-4">
          <p className="text-xs text-piste-700 mb-3">Confirme le passage à la phase « {LABEL_PHASE[sequence[phaseIndex + 1]]} »</p>
          <div className="flex items-center justify-center gap-3">
            <button onClick={confirmerPhaseSuivante} className="bg-piste-800 text-white px-5 py-3 rounded-xl font-medium">Confirmer</button>
            <button onClick={() => setConfirmation(null)} className="text-xs text-piste-500 underline px-2">Annuler</button>
          </div>
        </div>
      )}

      {confirmation === 'finRun' && (
        <div className="rounded-xl border-2 border-alerte/40 bg-[#fbeeea] p-4">
          <p className="text-xs text-piste-700 mb-3">Confirme pour terminer et enregistrer ce run</p>
          <div className="flex items-center justify-center gap-3">
            <button onClick={confirmerFinRun} className="bg-alerte text-white px-5 py-3 rounded-xl font-medium">Confirmer la fin</button>
            <button onClick={() => setConfirmation(null)} className="text-xs text-piste-500 underline px-2">Annuler</button>
          </div>
        </div>
      )}
    </div>
  )
}
