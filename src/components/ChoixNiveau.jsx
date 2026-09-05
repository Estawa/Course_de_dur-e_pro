import { MapPin, Timer as TimerIcon, Layers } from 'lucide-react'
import { formatDuree } from '../utils/calc'
import { totauxNiveau } from '../utils/fullpower'

const COULEURS = {
  Facile: 'border-piste-300 bg-piste-50',
  Moyen: 'border-cendre bg-[#f7f2e8]',
  Difficile: 'border-alerte/40 bg-[#fbeeea]'
}

export default function ChoixNiveau({ seance, vmaRef, onChoisirNiveau }) {
  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <h2 className="font-display text-2xl text-piste-900 mb-1">{seance.titre}</h2>
      <p className="text-sm text-piste-600 mb-6">Choisis le niveau que tu veux réaliser aujourd'hui. Tu pourras consulter le détail avant de démarrer.</p>

      <div className="space-y-4">
        {seance.niveaux.map((niveau) => {
          const { distance, duree } = totauxNiveau(niveau, vmaRef)
          return (
            <button
              key={niveau.id}
              onClick={() => onChoisirNiveau(niveau)}
              className={`w-full text-left rounded-2xl border-2 p-5 transition hover:shadow-md active:scale-[0.99] ${COULEURS[niveau.nom] || 'border-piste-200 bg-white'}`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="font-display text-xl text-piste-900">{niveau.nom}</span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-sm text-piste-700">
                <div className="flex items-center gap-1.5">
                  <Layers size={15} className="text-piste-500" />
                  {niveau.blocs.length} bloc{niveau.blocs.length > 1 ? 's' : ''}
                </div>
                <div className="flex items-center gap-1.5">
                  <MapPin size={15} className="text-piste-500" />
                  ~{distance} m
                </div>
                <div className="flex items-center gap-1.5">
                  <TimerIcon size={15} className="text-piste-500" />
                  {formatDuree(duree)}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
