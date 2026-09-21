import { useEffect, useState } from 'react'
import { beep, beepDepart, beepFin, annoncerVocal } from '../utils/audio'

// Prise de pouls sur 12 secondes, en 3 étapes :
// 1) annonce ("Attention, prise de votre pouls sur 12 secondes !"), vocale + affichée, quelques
//    secondes pour que l'élève se prépare (main sur le poignet/le cou) ;
// 2) pré-décompte visuel 5→1 pour synchroniser le départ ;
// 3) décompte 12→0 pendant que l'élève compte ses pulsations, puis il indique lui-même le
//    résultat ramené à la minute (x5, calcul fait par l'élève) — l'appli ne fait que demander
//    la valeur /1min une fois le décompte terminé.
const DUREE_ANNONCE_S = 3

export default function PriseDePouls({ titre = 'Prise de pouls', sousTitre, onValide }) {
  const [etape, setEtape] = useState('annonce') // annonce | preCompte | compte | saisie
  const [preCompte, setPreCompte] = useState(5)
  const [compte, setCompte] = useState(12)
  const [pouls, setPouls] = useState('')

  useEffect(() => {
    if (etape !== 'annonce') return
    annoncerVocal('Attention, prise de votre pouls sur 12 secondes !')
    const t = setTimeout(() => setEtape('preCompte'), DUREE_ANNONCE_S * 1000)
    return () => clearTimeout(t)
  }, [etape])

  useEffect(() => {
    if (etape !== 'preCompte') return
    if (preCompte <= 0) {
      setEtape('compte')
      return
    }
    beep({ freq: 440, duration: 0.08, volume: 0.25 })
    const t = setTimeout(() => setPreCompte((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [etape, preCompte])

  useEffect(() => {
    if (etape !== 'compte') return
    if (compte === 12) beepDepart()
    if (compte <= 0) {
      beepFin()
      setEtape('saisie')
      return
    }
    const t = setTimeout(() => setCompte((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [etape, compte])

  if (etape === 'annonce') {
    return (
      <div className="max-w-md mx-auto px-6 py-20 text-center">
        <p className="text-piste-600 mb-1">{titre}</p>
        {sousTitre && <p className="text-xs text-piste-500 mb-6">{sousTitre}</p>}
        <p className="text-lg font-medium text-piste-900 mt-8">Attention, prise de votre pouls sur 12 secondes !</p>
        <p className="text-xs text-piste-500 mt-4">Prépare-toi à compter tes pulsations (poignet ou cou).</p>
      </div>
    )
  }

  if (etape === 'preCompte') {
    return (
      <div className="max-w-md mx-auto px-6 py-20 text-center">
        <p className="text-piste-600 mb-1">{titre}</p>
        {sousTitre && <p className="text-xs text-piste-500 mb-6">{sousTitre}</p>}
        <p className="text-xs text-piste-500 mb-6">Le décompte des 12 secondes démarre dans...</p>
        <div className="font-display text-7xl text-piste-900 tabular-nums">{preCompte}</div>
      </div>
    )
  }

  if (etape === 'compte') {
    return (
      <div className="max-w-md mx-auto px-6 py-20 text-center">
        <p className="text-piste-600 mb-1">{titre}</p>
        {sousTitre && <p className="text-xs text-piste-500 mb-6">{sousTitre}</p>}
        <p className="text-xs text-piste-500 mb-6">Compte tes pulsations cardiaques jusqu'à ce que le décompte atteigne 0.</p>
        <div className="font-display text-7xl text-piste-900 tabular-nums">{compte}</div>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto px-6 py-16 text-center">
      <p className="text-piste-600 mb-1">{titre}</p>
      <p className="text-xs text-piste-500 mb-6">Multiplie par 5 le nombre de pulsations comptées, et indique le résultat sur 1 minute.</p>
      <div className="flex items-center justify-center gap-2 mb-8">
        <input
          type="number"
          min="0"
          inputMode="numeric"
          value={pouls}
          onChange={(e) => setPouls(e.target.value)}
          placeholder="0"
          className="w-28 text-center text-3xl font-display rounded-xl border-2 border-piste-200 px-3 py-3 focus:outline-none focus:border-piste-500"
        />
        <span className="text-piste-600 text-sm">bpm/min</span>
      </div>
      <button
        disabled={pouls === ''}
        onClick={() => onValide(Math.max(0, Math.round(Number(pouls) || 0)))}
        className="w-full bg-piste-800 hover:bg-piste-700 disabled:opacity-40 text-white font-medium py-3.5 rounded-xl transition active:scale-[0.98]"
      >
        Valider
      </button>
    </div>
  )
}
