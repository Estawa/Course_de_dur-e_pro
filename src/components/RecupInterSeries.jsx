import { useEffect, useRef, useState } from 'react'
import { beepFin, annoncerVocal, gongTransition } from '../utils/audio'
import { formatDuree, vitesseVersAllure, vitesseVersTemps50m } from '../utils/calc'

// Écran "Récupération entre les séries" : décompte de la récupération réglée après la série qui
// vient de se terminer. Le décompte part de la fin de la dernière répétition (finTs calculé par
// SeanceRunner à ce moment-là) : le temps passé à saisir la distance et le bilan de la série en
// fait donc partie, sans s'y ajouter. À zéro, la série suivante démarre d'elle-même (décompte de
// départ habituel) ; l'élève peut aussi repartir plus tôt.
export default function RecupInterSeries({ finTs, labelSuivante, vitesseKmh, retourDepart, onTermine }) {
  const [reste, setReste] = useState(() => Math.max(0, (finTs - Date.now()) / 1000))
  const termineRef = useRef(false)
  const [confirmation, setConfirmation] = useState(false)
  const confirmationRef = useRef(null)

  useEffect(() => {
    annoncerVocal('Récupération entre les parties')
    const iv = setInterval(() => {
      const r = Math.max(0, (finTs - Date.now()) / 1000)
      setReste(r)
      if (r <= 0 && !termineRef.current) {
        termineRef.current = true
        clearInterval(iv)
        beepFin()
        gongTransition()
        onTermine()
      }
    }, 250)
    return () => {
      clearInterval(iv)
      clearTimeout(confirmationRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finTs])

  function repartir() {
    if (!confirmation) {
      setConfirmation(true)
      confirmationRef.current = setTimeout(() => setConfirmation(false), 3000)
      return
    }
    if (termineRef.current) return
    termineRef.current = true
    onTermine()
  }

  return (
    <div className="max-w-md mx-auto px-6 py-10 text-center">
      {retourDepart && (
        <div className="rounded-2xl bg-alerte text-white px-5 py-4 mb-6">
          <p className="font-display text-lg leading-snug">Retourne au départ avant la prochaine partie !</p>
        </div>
      )}
      <p className="text-xs uppercase tracking-wide text-piste-500 mb-1">Récupération entre les parties</p>
      <div className="font-display text-7xl text-piste-900 tabular-nums mb-2">-{formatDuree(reste)}</div>
      {vitesseKmh > 0 && (
        <p className="text-sm text-piste-500 mb-1">Allure de récup : {vitesseVersAllure(vitesseKmh)} · {vitesseVersTemps50m(vitesseKmh)}</p>
      )}
      <p className="text-sm text-piste-700 mb-10">Ensuite : {labelSuivante}</p>

      <button
        onClick={repartir}
        className={`w-full font-medium py-3.5 rounded-xl transition active:scale-[0.98] ${confirmation ? 'bg-alerte text-white' : 'bg-piste-800 hover:bg-piste-700 text-white'}`}
      >
        {confirmation ? 'Confirmer : repartir maintenant' : 'Je suis prêt : démarrer la partie suivante'}
      </button>
    </div>
  )
}
