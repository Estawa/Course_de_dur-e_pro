import { X } from 'lucide-react'
import { formatDuree } from '../utils/calc'
import { vitesseMax, meilleurKmMs, formatMinSec, formatDistance, LABEL_PHASE } from '../utils/runDirect'
import RunDirectCarte from './RunDirectCarte'

// Revoir, depuis l'historique, la carte et les stats d'un Run en direct déjà réalisé (la trace
// GPS complète est conservée dans la réalisation dès l'enregistrement — voir App.jsx).
export default function RunDirectCarteModal({ titre, date, resultat, onClose }) {
  const { dureeGlobaleMs, distanceGlobaleM, phases, points } = resultat
  const vMax = vitesseMax(points)
  const meilleurKm = meilleurKmMs(points)
  const phaseCourse = phases.find((p) => p.phase === 'course')

  return (
    <div className="fixed inset-0 bg-black/40 z-30 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-white flex items-center justify-between px-5 py-4 border-b border-piste-100">
          <div>
            <p className="font-display text-lg text-piste-900">{titre}</p>
            <p className="text-xs text-piste-500">{new Date(date).toLocaleDateString('fr-FR')}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-piste-100 text-piste-500">
            <X size={18} />
          </button>
        </div>

        <div className="p-5">
          <div className="grid grid-cols-2 gap-3 mb-5 text-left">
            <div className="bg-piste-50 rounded-xl px-3 py-2.5">
              <p className="text-[11px] text-piste-500">Temps total</p>
              <p className="font-display text-lg text-piste-900">{formatDuree(dureeGlobaleMs / 1000)}</p>
            </div>
            <div className="bg-piste-50 rounded-xl px-3 py-2.5">
              <p className="text-[11px] text-piste-500">Distance totale</p>
              <p className="font-display text-lg text-piste-900">{formatDistance(distanceGlobaleM)}</p>
            </div>
            <div className="bg-piste-50 rounded-xl px-3 py-2.5">
              <p className="text-[11px] text-piste-500">Vitesse max</p>
              <p className="font-display text-lg text-piste-900">{vMax} km/h</p>
            </div>
            <div className="bg-piste-50 rounded-xl px-3 py-2.5">
              <p className="text-[11px] text-piste-500">Meilleur km</p>
              <p className="font-display text-lg text-piste-900">{formatMinSec(meilleurKm)}</p>
            </div>
            {phaseCourse?.pctVmaMoyen != null && (
              <div className="bg-piste-50 rounded-xl px-3 py-2.5 col-span-2">
                <p className="text-[11px] text-piste-500">%VMA moyen de l'entraînement</p>
                <p className="font-display text-lg text-piste-900">{phaseCourse.pctVmaMoyen}%</p>
              </div>
            )}
          </div>

          {phases.length > 1 && (
            <div className="space-y-2 mb-5 text-left">
              {phases.map((p) => (
                <div key={p.phase} className="bg-piste-50 rounded-xl px-4 py-2.5">
                  <p className="text-sm font-medium text-piste-900">{LABEL_PHASE[p.phase]}</p>
                  <p className="text-xs text-piste-500 mt-0.5">
                    {formatDuree(p.dureeMs / 1000)} · {formatDistance(p.distanceM)} · {p.vitesseMoyenne} km/h
                    {p.pctVmaMoyen != null && ` · ${p.pctVmaMoyen}% VMA`}
                  </p>
                </div>
              ))}
            </div>
          )}

          <p className="text-xs font-semibold text-piste-500 uppercase tracking-wide mb-2 text-left">Trajet</p>
          <RunDirectCarte points={points} />
        </div>
      </div>
    </div>
  )
}
