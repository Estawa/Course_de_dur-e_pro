import { useEffect, useRef, useState } from 'react'
import { Play, Square } from 'lucide-react'
import { beep, beepDepart, beepFin } from '../utils/audio'
import { formatDuree } from '../utils/calc'
import { storage } from '../utils/storage'
import { useGpsSuivi } from '../utils/gps'
import IndicateurGps from './IndicateurGps'

const DUREE = 6 * 60

export default function TestDemiCooper({ eleve, onRetour }) {
  const [etat, setEtat] = useState('attente') // attente | course | saisie | resultat
  const [elapsed, setElapsed] = useState(0)
  const [km, setKm] = useState('')
  const [m, setM] = useState('')
  const [distanceCourse, setDistanceCourse] = useState(0) // distance GPS depuis le départ, pour l'affichage live
  const [vmaCalculee, setVmaCalculee] = useState(null)
  const [viaGPS, setViaGPS] = useState(false)
  const [enregistre, setEnregistre] = useState(false)
  const startRef = useRef(null)
  const intervalRef = useRef(null)

  // Le suivi GPS tourne en continu dès l'ouverture de l'écran, jamais réinitialisé : on relève
  // juste la distance totale au départ et à l'arrivée pour en déduire la distance parcourue.
  const { gpsOk, distanceTotale, vitesseInstant, checkpoint } = useGpsSuivi()
  const gpsOkRef = useRef(gpsOk)
  useEffect(() => { gpsOkRef.current = gpsOk }, [gpsOk])
  const departRef = useRef(0)

  useEffect(() => {
    if (etat !== 'course') return
    intervalRef.current = setInterval(() => {
      const t = (Date.now() - startRef.current) / 1000
      if (t >= DUREE) {
        setElapsed(DUREE)
        beepFin()
        clearInterval(intervalRef.current)
        terminerCourse()
      } else {
        setElapsed(t)
      }
    }, 200)
    return () => clearInterval(intervalRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etat])

  function demarrer() {
    beepDepart()
    startRef.current = Date.now()
    departRef.current = checkpoint()
    setEtat('course')
  }

  // Fin des 6 minutes (ou arrêt anticipé) : si le GPS était actif pendant la course, la
  // distance est mesurée automatiquement (différence de relevés) et le résultat calculé
  // directement, sans saisie — même principe que la validation automatique du VAM-EVAL. Sans
  // GPS, on retombe sur la saisie manuelle de la distance, comme avant.
  function terminerCourse() {
    if (gpsOkRef.current === true) {
      const mesure = checkpoint() - departRef.current
      calculerDepuis(mesure, true)
    } else {
      setEtat('saisie')
    }
  }

  function calculerDepuis(distanceM, gps) {
    const vma = Math.round((distanceM / 100) * 10) / 10
    setVmaCalculee(vma)
    setViaGPS(gps)
    setEtat('resultat')
    storage.enregistrerResultatTest(eleve, vma, 'cooper', { distance: Math.round(distanceM), viaGPS: gps })
    setEnregistre(true)
  }

  // Le résultat est enregistré automatiquement dès qu'il est calculé (plus besoin
  // d'un clic supplémentaire que l'élève pourrait oublier de faire).
  function calculer() {
    const distanceSaisie = (Number(km) || 0) * 1000 + (Number(m) || 0)
    calculerDepuis(distanceSaisie, false)
  }

  // Affichage live de la distance parcourue pendant la course (relevé courant - relevé au départ).
  const distanceEnCours = Math.max(0, distanceTotale - departRef.current)

  if (etat === 'attente') {
    return (
      <div className="max-w-md mx-auto px-6 py-16 text-center">
        <h2 className="font-display text-2xl text-piste-900 mb-2">Demi-Cooper (6 min)</h2>
        <p className="text-sm text-piste-600 mb-3">Cours la plus grande distance possible en 6 minutes. Le chrono démarre au bip.</p>
        <p className="text-xs text-piste-500 mb-5">
          Si le GPS est actif, ta distance sera mesurée automatiquement à la fin du test.
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

  if (etat === 'course') {
    return (
      <div className="max-w-md mx-auto px-6 py-16 text-center">
        <p className="text-sm text-piste-600 mb-4">Temps restant</p>
        <div className="font-display text-7xl text-piste-900 mb-6 tabular-nums">{formatDuree(DUREE - elapsed)}</div>
        {gpsOk === true && (
          <div className="rounded-2xl border-2 border-piste-400 bg-piste-50 p-4 mb-6">
            <p className="font-display text-2xl text-piste-900 tabular-nums">{Math.round(distanceEnCours)} m</p>
            <p className="text-xs text-piste-600">{vitesseInstant.toFixed(1)} km/h · distance mesurée par GPS</p>
          </div>
        )}
        {gpsOk === false && (
          <p className="text-xs text-alerte mb-6">GPS indisponible : tu devras saisir ta distance à la fin.</p>
        )}
        <button
          onClick={() => { beep({ freq: 400 }); clearInterval(intervalRef.current); terminerCourse() }}
          className="flex items-center gap-2 mx-auto bg-alerte text-white px-5 py-3 rounded-xl"
        >
          <Square size={16} fill="white" /> Arrêter
        </button>
      </div>
    )
  }

  if (etat === 'saisie') {
    return (
      <div className="max-w-md mx-auto px-6 py-16 text-center">
        <h2 className="font-display text-2xl text-piste-900 mb-6">Distance parcourue</h2>
        <div className="flex items-center gap-2 justify-center mb-6">
          <input type="number" value={km} onChange={(e) => setKm(e.target.value)} placeholder="km" className="w-20 rounded-lg border border-piste-200 px-2 py-2 text-center" />
          <input type="number" value={m} onChange={(e) => setM(e.target.value)} placeholder="m" className="w-20 rounded-lg border border-piste-200 px-2 py-2 text-center" />
        </div>
        <button onClick={calculer} className="w-full bg-piste-800 text-white font-medium py-3 rounded-xl">Calculer ma VMA</button>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto px-6 py-16 text-center">
      <h2 className="font-display text-2xl text-piste-900 mb-1">Résultat</h2>
      <p className="font-display text-4xl text-piste-900 mb-3">{vmaCalculee} km/h</p>
      <p className="text-xs text-piste-500 mb-4">
        {viaGPS ? 'Distance mesurée par GPS.' : 'Distance saisie manuellement (GPS indisponible pendant le test).'}
      </p>
      {enregistre && <p className="text-sm text-piste-600 mb-3">Résultat transmis. Il sera pris en compte, sauf si ton professeur a fixé une autre valeur.</p>}
      <button onClick={onRetour} className="text-xs text-piste-400 underline">Retour aux tests</button>
    </div>
  )
}
