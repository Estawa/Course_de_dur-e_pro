import { useState } from 'react'

// N'apparaît que lorsque le GPS n'a pas pu mesurer la distance du bloc (viaGPS === false) :
// jusqu'ici, l'appli supposait silencieusement que la distance prévue avait été parcourue dès
// que le temps prévu était écoulé. On demande maintenant à l'élève une estimation, plus fidèle
// que cette hypothèse par défaut — sans réintroduire de saisie libre quand le GPS a bien
// fonctionné (pour ne pas ouvrir la porte à une correction de complaisance sur une mesure fiable).
export default function CorrectionDistance({ distanceCible, onValide }) {
  const [distance, setDistance] = useState(distanceCible != null ? String(distanceCible) : '')

  return (
    <div className="max-w-md mx-auto px-6 py-10 text-center">
      <h2 className="font-display text-xl text-piste-900 mb-2">GPS indisponible sur ce bloc</h2>
      <p className="text-sm text-piste-600 mb-6">
        Le GPS n'a pas pu mesurer ta distance. Indique la distance que tu penses avoir réellement
        parcourue, pour que ta fiche reste fidèle à ce que tu as fait.
      </p>
      <div className="bg-piste-50 rounded-xl p-4 mb-6 text-left">
        <p className="text-xs text-piste-500">Distance prévue</p>
        <p className="text-sm font-medium text-piste-900">{distanceCible} m</p>
      </div>
      <div className="flex items-center justify-center gap-2 mb-6">
        <input
          type="number"
          min="0"
          value={distance}
          onChange={(e) => setDistance(e.target.value)}
          className="w-32 text-center text-2xl font-display rounded-xl border-2 border-piste-200 px-3 py-3 focus:outline-none focus:border-piste-500"
        />
        <span className="text-piste-600">m</span>
      </div>
      <button
        onClick={() => onValide(Math.max(0, Math.round(Number(distance) || 0)))}
        className="w-full bg-piste-800 hover:bg-piste-700 text-white font-medium py-3.5 rounded-xl transition active:scale-[0.98]"
      >
        Valider cette distance
      </button>
    </div>
  )
}
