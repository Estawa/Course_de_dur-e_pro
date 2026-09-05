import { useEffect } from 'react'
import { beepFin, annoncerVocal } from '../utils/audio'

export default function FinSeanceAnnonce({ onTermine }) {
  useEffect(() => {
    beepFin()
    annoncerVocal('Fin de séance !')
    const t = setTimeout(onTermine, 1800)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="max-w-md mx-auto px-6 py-28 text-center">
      <h2 className="font-display text-3xl text-piste-900 mb-6">Fin de séance !</h2>
      <button onClick={onTermine} className="text-xs text-piste-400 underline">Continuer</button>
    </div>
  )
}
