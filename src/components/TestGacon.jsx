import { useEffect, useRef, useState } from 'react'
import { Play, Square } from 'lucide-react'
import { beepDepart, beepFin, beep } from '../utils/audio'
import { storage } from '../utils/storage'

const DUREE_EFFORT = 45
const DUREE_RECUP = 15

function vitessePalier(p) {
  return 8 + (p - 1) * 0.5
}

function distancePalier(p) {
  return Math.round((vitessePalier(p) * DUREE_EFFORT * 1000) / 3600)
}

export default function TestGacon({ eleve, onRetour }) {
  const [palier, setPalier] = useState(1)
  const [phase, setPhase] = useState('attente') // attente | effort | recup | resultat
  const [elapsed, setElapsed] = useState(0)
  const [resultat, setResultat] = useState(null)
  const [enregistre, setEnregistre] = useState(false)
  const startRef = useRef(null)
  const intervalRef = useRef(null)

  const dureePhase = phase === 'effort' ? DUREE_EFFORT : DUREE_RECUP

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
        }
      } else {
        setElapsed(t)
      }
    }, 100)
    return () => clearInterval(intervalRef.current)
  }, [phase])

  function demarrer() {
    beepDepart()
    startRef.current = Date.now()
    setPhase('effort')
  }

  function arreter() {
    beepFin()
    clearInterval(intervalRef.current)

    let vma
    if (phase === 'effort') {
      const vitessePrecedente = palier > 1 ? vitessePalier(palier - 1) : 0
      const bonus = elapsed >= 20 && elapsed <= 30 ? 0.25 : 0
      vma = Math.round((vitessePrecedente + bonus) * 100) / 100
    } else {
      vma = vitessePalier(palier)
    }
    setResultat({ palier, vma })
    setPhase('resultat')
  }

  function enregistrerVma() {
    storage.enregistrerResultatTest(eleve, resultat.vma, 'gacon')
    setEnregistre(true)
  }

  if (phase === 'attente') {
    return (
      <div className="max-w-md mx-auto px-6 py-16 text-center">
        <h2 className="font-display text-2xl text-piste-900 mb-2">Test Gacon (45/15)</h2>
        <p className="text-sm text-piste-600 mb-8">
          Cours jusqu'au plot dans le temps imparti, marche pendant la récupération pour rejoindre le plot suivant. La vitesse augmente à chaque palier de 45 secondes.
        </p>
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
        <p className="text-sm text-piste-600 mb-4">{phase === 'effort' ? `Cours jusqu'au plot (${distancePalier(palier)} m)` : 'Marche jusqu\'au plot suivant'}</p>
        <div className="font-display text-7xl text-piste-900 mb-8 tabular-nums">{Math.max(0, Math.round(dureePhase - elapsed))}</div>
        <button onClick={arreter} className="flex items-center gap-2 mx-auto bg-alerte text-white px-5 py-3 rounded-xl">
          <Square size={16} fill="white" /> Je n'en peux plus
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto px-6 py-16 text-center">
      <h2 className="font-display text-2xl text-piste-900 mb-1">Palier atteint : {resultat.palier}</h2>
      <p className="font-display text-4xl text-piste-900 mb-6">{resultat.vma} km/h</p>
      {enregistre ? (
        <p className="text-sm text-piste-600 mb-3">Résultat transmis. Il sera pris en compte, sauf si ton professeur a fixé une autre valeur.</p>
      ) : (
        <button onClick={enregistrerVma} className="w-full bg-piste-800 text-white font-medium py-3 rounded-xl mb-3">Enregistrer ce résultat</button>
      )}
      <button onClick={onRetour} className="text-xs text-piste-400 underline">Retour aux tests</button>
    </div>
  )
}
