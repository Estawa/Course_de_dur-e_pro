import { useEffect, useRef, useState } from 'react'
import { Play, Square, RotateCcw } from 'lucide-react'
import { beep } from '../utils/audio'
import { formatDuree } from '../utils/calc'

export default function Chronometre() {
  const [enCours, setEnCours] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [km, setKm] = useState('')
  const [m, setM] = useState('')
  const startRef = useRef(null)
  const intervalRef = useRef(null)

  useEffect(() => {
    if (!enCours) return
    intervalRef.current = setInterval(() => setElapsed((Date.now() - startRef.current) / 1000), 100)
    return () => clearInterval(intervalRef.current)
  }, [enCours])

  function demarrer() {
    beep({ freq: 700, duration: 0.12 })
    startRef.current = Date.now() - elapsed * 1000
    setEnCours(true)
  }

  function arreter() {
    beep({ freq: 400, duration: 0.15 })
    setEnCours(false)
    clearInterval(intervalRef.current)
  }

  function reinitialiser() {
    setElapsed(0)
    setKm('')
    setM('')
  }

  const distanceM = (Number(km) || 0) * 1000 + (Number(m) || 0)
  const vitesse = elapsed > 0 && distanceM > 0 ? (distanceM / 1000) / (elapsed / 3600) : null

  return (
    <div className="max-w-md mx-auto px-6 py-10 text-center">
      <h2 className="font-display text-2xl text-piste-900 mb-6">Chronomètre</h2>

      <div className="font-display text-6xl text-piste-900 mb-8 tabular-nums">{formatDuree(elapsed)}</div>

      {!enCours ? (
        <button
          onClick={demarrer}
          className="w-24 h-24 mx-auto rounded-full bg-piste-800 hover:bg-piste-700 text-white flex items-center justify-center mb-8 active:scale-95 transition"
        >
          <Play size={32} fill="white" />
        </button>
      ) : (
        <button
          onClick={arreter}
          className="w-24 h-24 mx-auto rounded-full bg-alerte hover:bg-alerte/90 text-white flex items-center justify-center mb-8 active:scale-95 transition"
        >
          <Square size={28} fill="white" />
        </button>
      )}

      <div className="bg-piste-50 rounded-xl p-4 mb-4">
        <p className="text-xs font-medium text-piste-700 mb-2">Distance parcourue</p>
        <div className="flex items-center gap-2 justify-center">
          <input
            type="number"
            value={km}
            onChange={(e) => setKm(e.target.value)}
            placeholder="km"
            className="w-20 rounded-lg border border-piste-200 px-2 py-1.5 text-sm text-center"
          />
          <input
            type="number"
            value={m}
            onChange={(e) => setM(e.target.value)}
            placeholder="m"
            className="w-20 rounded-lg border border-piste-200 px-2 py-1.5 text-sm text-center"
          />
        </div>
        {vitesse && <p className="text-sm text-piste-800 mt-3">Vitesse moyenne : <span className="font-display">{vitesse.toFixed(2)} km/h</span></p>}
      </div>

      <button onClick={reinitialiser} className="flex items-center gap-1.5 text-xs text-piste-500 mx-auto">
        <RotateCcw size={13} /> Réinitialiser
      </button>
    </div>
  )
}
