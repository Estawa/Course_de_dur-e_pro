import { useEffect, useRef, useState } from 'react'
import { beepDepart, beepFin, annoncerVocal } from '../utils/audio'
import { formatDuree } from '../utils/calc'

export default function Echauffement({ duree_s, onTermine }) {
  const [elapsed, setElapsed] = useState(0)
  const startRef = useRef(null)
  const intervalRef = useRef(null)
  const termineRef = useRef(false)

  useEffect(() => {
    beepDepart()
    annoncerVocal('Départ échauffement !')
    startRef.current = Date.now()
    intervalRef.current = setInterval(() => {
      const t = (Date.now() - startRef.current) / 1000
      if (t >= duree_s) {
        setElapsed(duree_s)
        if (!termineRef.current) {
          termineRef.current = true
          clearInterval(intervalRef.current)
          beepFin()
          onTermine()
        }
      } else {
        setElapsed(t)
      }
    }, 250)
    return () => clearInterval(intervalRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function passer() {
    if (termineRef.current) return
    termineRef.current = true
    clearInterval(intervalRef.current)
    onTermine()
  }

  return (
    <div className="max-w-md mx-auto px-6 py-24 text-center">
      <p className="text-xs uppercase tracking-wide text-piste-500 mb-2">Échauffement</p>
      <h2 className="font-display text-2xl text-piste-900 mb-8">Départ Échauffement !</h2>
      <div className="font-display text-7xl text-piste-900 mb-10 tabular-nums">{formatDuree(Math.max(0, duree_s - elapsed))}</div>
      <button onClick={passer} className="text-xs text-piste-400 underline">Passer l'échauffement</button>
    </div>
  )
}
