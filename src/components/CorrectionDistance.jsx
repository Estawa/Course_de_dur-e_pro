import { useState } from 'react'

// N'apparaît que lorsque le GPS n'a pas pu mesurer la distance du bloc (viaGPS === false).
// Le champ démarre VIDE, volontairement : jusqu'en v1.44.0, il était pré-rempli avec la distance
// prévue, ce qui revenait à supposer silencieusement une réussite à 100% dès que le temps prévu
// était écoulé (y compris quand ce temps s'était juste écoulé pendant que l'appli était en
// arrière-plan/le téléphone verrouillé, sans que l'élève ait couru) — l'élève n'avait qu'à valider
// sans réfléchir pour obtenir le maximum. Le bouton reste désormais désactivé tant qu'aucune
// valeur n'a été saisie, pour forcer une estimation réellement active.
export default function CorrectionDistance({ distanceCible, onValide }) {
  const [distance, setDistance] = useState('')

  return (
    <div className="max-w-md mx-auto px-6 py-10 text-center">
      <h2 className="font-display text-xl text-piste-900 mb-2">GPS indisponible sur ce bloc</h2>
      <p className="text-sm text-piste-600 mb-6">
        Le GPS n'a pas pu mesurer ta distance. Indique la distance que tu penses avoir réellement
        parcourue, pour que ta fiche reste fidèle à ce que tu as fait — pas forcément la distance
        prévue.
      </p>
      <div className="bg-piste-50 rounded-xl p-4 mb-6 text-left">
        <p className="text-xs text-piste-500">Distance prévue (à titre indicatif seulement)</p>
        <p className="text-sm font-medium text-piste-900">{distanceCible} m</p>
      </div>
      <div className="flex items-center justify-center gap-2 mb-6">
        <input
          type="number"
          min="0"
          inputMode="numeric"
          value={distance}
          onChange={(e) => setDistance(e.target.value)}
          placeholder="0"
          className="w-32 text-center text-2xl font-display rounded-xl border-2 border-piste-200 px-3 py-3 focus:outline-none focus:border-piste-500"
        />
        <span className="text-piste-600">m</span>
      </div>
      <button
        disabled={distance === ''}
        onClick={() => onValide(Math.max(0, Math.round(Number(distance) || 0)))}
        className="w-full bg-piste-800 hover:bg-piste-700 disabled:opacity-40 text-white font-medium py-3.5 rounded-xl transition active:scale-[0.98]"
      >
        Valider cette distance
      </button>
    </div>
  )
}
