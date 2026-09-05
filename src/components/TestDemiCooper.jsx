import { useEffect, useRef, useState } from 'react'
import { Play, Square } from 'lucide-react'
import { beep, beepDepart, beepFin } from '../utils/audio'
import { formatDuree } from '../utils/calc'
import { storage } from '../utils/storage'

const DUREE = 6 * 60

export default function TestDemiCooper({ eleve, onRetour }) {
  const [etat, setEtat] = useState('attente') // attente | course | saisie
  const [elapsed, setElapsed] = useState(0)
  const [km, setKm] = useState('')
  const [m, setM] = useState('')
  const [vmaCalculee, setVmaCalculee] = useState(null)
  const [enregistre, setEnregistre] = useState(false)
  const startRef = useRef(null)
  const intervalRef = useRef(null)

  useEffect(() => {
    if (etat !== 'course') return
    intervalRef.current = setInterval(() => {
      const t = (Date.now() - startRef.current) / 1000
      if (t >= DUREE) {
        setElapsed(DUREE)
        beepFin()
        clearInterval(intervalRef.current)
        setEtat('saisie')
      } else {
        setElapsed(t)
      }
    }, 200)
    return () => clearInterval(intervalRef.current)
  }, [etat])

  function demarrer() {
    beepDepart()
    startRef.current = Date.now()
    setEtat('course')
  }

  function calculer() {
    const distance = (Number(km) || 0) * 1000 + (Number(m) || 0)
    const vma = Math.round((distance / 100) * 10) / 10
    setVmaCalculee(vma)
  }

  function enregistrerVma() {
    storage.enregistrerResultatTest(eleve, vmaCalculee, 'cooper')
    setEnregistre(true)
  }

  if (etat === 'attente') {
    return (
      <div className="max-w-md mx-auto px-6 py-16 text-center">
        <h2 className="font-display text-2xl text-piste-900 mb-2">Demi-Cooper (6 min)</h2>
        <p className="text-sm text-piste-600 mb-8">Cours la plus grande distance possible en 6 minutes. Le chrono démarre au bip.</p>
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
      <div className="max-w-md mx-auto px-6 py-20 text-center">
        <p className="text-sm text-piste-600 mb-4">Temps restant</p>
        <div className="font-display text-7xl text-piste-900 mb-8 tabular-nums">{formatDuree(DUREE - elapsed)}</div>
        <button
          onClick={() => { beep({ freq: 400 }); clearInterval(intervalRef.current); setEtat('saisie') }}
          className="flex items-center gap-2 mx-auto bg-alerte text-white px-5 py-3 rounded-xl"
        >
          <Square size={16} fill="white" /> Arrêter
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto px-6 py-16 text-center">
      <h2 className="font-display text-2xl text-piste-900 mb-6">Distance parcourue</h2>
      <div className="flex items-center gap-2 justify-center mb-6">
        <input type="number" value={km} onChange={(e) => setKm(e.target.value)} placeholder="km" className="w-20 rounded-lg border border-piste-200 px-2 py-2 text-center" />
        <input type="number" value={m} onChange={(e) => setM(e.target.value)} placeholder="m" className="w-20 rounded-lg border border-piste-200 px-2 py-2 text-center" />
      </div>
      {vmaCalculee === null ? (
        <button onClick={calculer} className="w-full bg-piste-800 text-white font-medium py-3 rounded-xl">Calculer ma VMA</button>
      ) : (
        <div>
          <p className="font-display text-3xl text-piste-900 mb-4">{vmaCalculee} km/h</p>
          {enregistre ? (
            <p className="text-sm text-piste-600 mb-3">Résultat transmis. Il sera pris en compte, sauf si ton professeur a fixé une autre valeur.</p>
          ) : (
            <button onClick={enregistrerVma} className="w-full bg-piste-800 text-white font-medium py-3 rounded-xl mb-3">Enregistrer ce résultat</button>
          )}
          <button onClick={onRetour} className="text-xs text-piste-400 underline">Retour aux tests</button>
        </div>
      )}
    </div>
  )
}
