import { Trophy } from 'lucide-react'
import { formatDuree } from '../utils/calc'
import { vitesseMax, meilleurKmMs, formatMinSec, formatDistance, LABEL_PHASE } from '../utils/runDirect'
import RunDirectCarte from './RunDirectCarte'

const PHRASES = [
  'Beau run, bien joué !',
  'Course dans la boîte, bravo !',
  'Objectif rempli, continue comme ça !',
  'Run enregistré, tu peux être fier de toi !'
]

export default function RunDirectBilan({ resultat, onRetourAccueil }) {
  const { mode, dureeGlobaleMs, distanceGlobaleM, phases, points } = resultat
  const phrase = PHRASES[Math.floor(Math.random() * PHRASES.length)]
  const vMax = vitesseMax(points)
  const meilleurKm = meilleurKmMs(points)
  const phaseCourse = phases.find((p) => p.phase === 'course')

  return (
    <div className="max-w-md mx-auto px-6 py-10 text-center">
      <div className="w-16 h-16 mx-auto rounded-full bg-piste-100 flex items-center justify-center mb-5">
        <Trophy className="text-piste-700" size={28} />
      </div>
      <h2 className="font-display text-2xl text-piste-900 mb-1">{phrase}</h2>
      <p className="text-sm text-piste-600 mb-6">{mode === 'complete' ? 'Run direct · Séance complète' : 'Run direct · Course immédiate'}</p>

      <div className="grid grid-cols-2 gap-3 mb-6 text-left">
        <div className="bg-piste-50 rounded-xl px-3 py-2.5">
          <p className="text-[11px] text-piste-500">Temps total</p>
          <p className="font-display text-xl text-piste-900">{formatDuree(dureeGlobaleMs / 1000)}</p>
        </div>
        <div className="bg-piste-50 rounded-xl px-3 py-2.5">
          <p className="text-[11px] text-piste-500">Distance totale</p>
          <p className="font-display text-xl text-piste-900">{formatDistance(distanceGlobaleM)}</p>
        </div>
        <div className="bg-piste-50 rounded-xl px-3 py-2.5">
          <p className="text-[11px] text-piste-500">Vitesse max</p>
          <p className="font-display text-xl text-piste-900">{vMax} km/h</p>
        </div>
        <div className="bg-piste-50 rounded-xl px-3 py-2.5">
          <p className="text-[11px] text-piste-500">Meilleur km</p>
          <p className="font-display text-xl text-piste-900">{formatMinSec(meilleurKm)}</p>
        </div>
        {phaseCourse?.pctVmaMoyen != null && (
          <div className="bg-piste-50 rounded-xl px-3 py-2.5 col-span-2">
            <p className="text-[11px] text-piste-500">%VMA moyen de l'entraînement</p>
            <p className="font-display text-xl text-piste-900">{phaseCourse.pctVmaMoyen}%</p>
          </div>
        )}
      </div>

      <div className="space-y-2 text-left mb-6">
        {phases.map((p) => (
          <div key={p.phase} className="bg-piste-50 rounded-xl px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-piste-900">{LABEL_PHASE[p.phase]}</p>
              <p className="text-xs text-piste-500 mt-0.5">
                {formatDuree(p.dureeMs / 1000)} · {formatDistance(p.distanceM)} · {p.vitesseMoyenne} km/h
                {p.pctVmaMoyen != null && ` · ${p.pctVmaMoyen}% VMA`}
              </p>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs font-semibold text-piste-500 uppercase tracking-wide mb-2 text-left">Ton trajet</p>
      <div className="mb-8">
        <RunDirectCarte points={points} />
      </div>

      <button
        onClick={onRetourAccueil}
        className="w-full bg-piste-800 hover:bg-piste-700 text-white font-medium py-3.5 rounded-xl transition active:scale-[0.98]"
      >
        Retour à l'accueil
      </button>
    </div>
  )
}
