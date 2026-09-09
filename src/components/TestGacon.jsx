import { useEffect, useRef, useState } from 'react'
import { Play, Square } from 'lucide-react'
import { beepDepart, beepFin, beep } from '../utils/audio'
import { storage } from '../utils/storage'
import { useGpsSuivi } from '../utils/gps'
import IndicateurGps from './IndicateurGps'

const DUREE_EFFORT = 45
const DUREE_RECUP = 15
const INCREMENT = 0.5

function vitessePalier(p) {
  return 8 + (p - 1) * INCREMENT
}

function distancePalier(p) {
  return (vitessePalier(p) * DUREE_EFFORT * 1000) / 3600
}

export default function TestGacon({ eleve, onRetour }) {
  const [palier, setPalier] = useState(1)
  const [phase, setPhase] = useState('attente') // attente | effort | recup | resultat
  const [elapsed, setElapsed] = useState(0)
  const [resultat, setResultat] = useState(null)
  const [enregistre, setEnregistre] = useState(false)
  const startRef = useRef(null)
  const intervalRef = useRef(null)

  // Suivi GPS continu dès l'ouverture de l'écran, jamais réinitialisé pendant tout le test : on
  // relève juste la distance totale au début et à la fin de chaque phase d'effort (la marche de
  // récupération n'est volontairement pas comptée) pour en déduire, par différence, la distance
  // réellement courue dans le palier.
  const { gpsOk, distanceTotale, vitesseInstant, checkpoint } = useGpsSuivi()
  const gpsOkRef = useRef(gpsOk)
  const palierRef = useRef(palier)
  const elapsedRef = useRef(elapsed)
  useEffect(() => { gpsOkRef.current = gpsOk }, [gpsOk])
  useEffect(() => { palierRef.current = palier }, [palier])
  useEffect(() => { elapsedRef.current = elapsed }, [elapsed])
  const departEffortRef = useRef(0)

  const dureePhase = phase === 'effort' ? DUREE_EFFORT : DUREE_RECUP
  // Affichage live de la distance courue depuis le début du palier d'effort en cours.
  const distancePalierEnCours = Math.max(0, distanceTotale - departEffortRef.current)

  useEffect(() => {
    if (phase !== 'effort' && phase !== 'recup') return
    intervalRef.current = setInterval(() => {
      const t = (Date.now() - startRef.current) / 1000
      if (t >= dureePhase) {
        clearInterval(intervalRef.current)
        if (phase === 'effort') {
          setPhase('recup')
          setElapsed(0)
          startRef.current = Date.now()
        } else {
          beepDepart()
          setPalier((p) => p + 1)
          setPhase('effort')
          setElapsed(0)
          startRef.current = Date.now()
          departEffortRef.current = checkpoint()
        }
      } else {
        setElapsed(t)
      }
    }, 100)
    return () => clearInterval(intervalRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  function demarrer() {
    beepDepart()
    startRef.current = Date.now()
    setPhase('effort')
    departEffortRef.current = checkpoint()
  }

  // Arrêt du test : si le GPS était actif pendant le palier en cours, la VMA est interpolée
  // sur la distance réellement parcourue (relevé de fin moins relevé de début du palier, même
  // principe que le VAM-EVAL) plutôt que sur le temps écoulé. Sans GPS, on retombe sur
  // l'ancienne estimation par le temps tenu dans le palier.
  function arreter() {
    beepFin()
    clearInterval(intervalRef.current)

    const palierActuel = palierRef.current
    const viaGpsCourant = phase === 'effort' && gpsOkRef.current === true
    let vma

    if (phase === 'recup') {
      // Le palier venait d'être pleinement tenu (chrono d'effort déjà écoulé).
      vma = vitessePalier(palierActuel)
    } else if (viaGpsCourant) {
      const requise = distancePalier(palierActuel)
      const mesure = checkpoint() - departEffortRef.current
      const fraction = Math.min(1, requise > 0 ? mesure / requise : 0)
      const vitessePrecedente = palierActuel > 1 ? vitessePalier(palierActuel - 1) : 0
      vma = Math.round((vitessePrecedente + INCREMENT * fraction) * 100) / 100
    } else {
      const vitessePrecedente = palierActuel > 1 ? vitessePalier(palierActuel - 1) : 0
      const bonus = elapsedRef.current >= 20 && elapsedRef.current <= 30 ? 0.25 : 0
      vma = Math.round((vitessePrecedente + bonus) * 100) / 100
    }

    setResultat({ palier: palierActuel, vma, viaGPS: phase === 'recup' ? true : viaGpsCourant })
    setPhase('resultat')
    // Enregistrement automatique dès l'obtention du résultat.
    storage.enregistrerResultatTest(eleve, vma, 'gacon', {
      palier: palierActuel,
      elapsedDansPalier: Math.round(elapsedRef.current),
      viaGPS: phase === 'recup' ? true : viaGpsCourant
    })
    setEnregistre(true)
  }

  if (phase === 'attente') {
    return (
      <div className="max-w-md mx-auto px-6 py-16 text-center">
        <h2 className="font-display text-2xl text-piste-900 mb-2">Test Gacon (45/15)</h2>
        <p className="text-sm text-piste-600 mb-3">
          Cours jusqu'au plot dans le temps imparti, marche pendant la récupération pour rejoindre le plot suivant. La vitesse augmente à chaque palier de 45 secondes.
        </p>
        <p className="text-xs text-piste-500 mb-5">
          Si le GPS est actif, ta VMA sera calculée sur la distance réellement parcourue.
        </p>
        <IndicateurGps gpsOk={gpsOk} className="mb-8" />
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

  if (phase === 'effort' || phase === 'recup') {
    return (
      <div className="max-w-md mx-auto px-6 py-14 text-center">
        <p className="text-xs uppercase tracking-wide text-piste-500 mb-1">Palier {palier} · {vitessePalier(palier)} km/h</p>
        <p className="text-sm text-piste-600 mb-4">{phase === 'effort' ? `Cours jusqu'au plot (${Math.round(distancePalier(palier))} m)` : 'Marche jusqu\'au plot suivant'}</p>
        <div className="font-display text-7xl text-piste-900 mb-6 tabular-nums">{Math.max(0, Math.round(dureePhase - elapsed))}</div>
        {phase === 'effort' && gpsOk === true && (
          <div className="rounded-2xl border-2 border-piste-400 bg-piste-50 p-4 mb-6">
            <p className="font-display text-2xl text-piste-900 tabular-nums">{Math.round(distancePalierEnCours)} / {Math.round(distancePalier(palier))} m</p>
            <p className="text-xs text-piste-600">{vitesseInstant.toFixed(1)} km/h</p>
          </div>
        )}
        {phase === 'effort' && gpsOk === false && (
          <p className="text-xs text-alerte mb-6">GPS indisponible : la VMA sera estimée sur le temps tenu dans le palier.</p>
        )}
        <button onClick={arreter} className="flex items-center gap-2 mx-auto bg-alerte text-white px-5 py-3 rounded-xl">
          <Square size={16} fill="white" /> Je n'en peux plus
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto px-6 py-16 text-center">
      <h2 className="font-display text-2xl text-piste-900 mb-1">Palier atteint : {resultat.palier}</h2>
      <p className="font-display text-4xl text-piste-900 mb-3">{resultat.vma} km/h</p>
      <p className="text-xs text-piste-500 mb-4">
        {resultat.viaGPS ? 'Distance vérifiée par GPS.' : 'Estimée sur le temps tenu (GPS indisponible pendant le palier).'}
      </p>
      {enregistre && <p className="text-sm text-piste-600 mb-3">Résultat transmis. Il sera pris en compte, sauf si ton professeur a fixé une autre valeur.</p>}
      <button onClick={onRetour} className="text-xs text-piste-400 underline">Retour aux tests</button>
    </div>
  )
}
