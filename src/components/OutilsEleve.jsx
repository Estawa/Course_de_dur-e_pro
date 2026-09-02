import { useState } from 'react'
import { ChevronRight, Gauge, ListChecks, Timer, Smile, TrendingUp } from 'lucide-react'
import VmaTests from './VmaTests'
import Chronometre from './Chronometre'
import BorgReference from './BorgReference'
import PerformancesEstimees from './PerformancesEstimees'
import { storage } from '../utils/storage'

export default function OutilsEleve({ eleve, onComposerSeance }) {
  const [ecran, setEcran] = useState('menu')
  const [vma, setVma] = useState(() => storage.getVma(eleve) || '')

  function enregistrerVma() {
    storage.setVma(eleve, Number(vma))
  }

  if (ecran === 'tests') return <VmaTests eleve={eleve} />
  if (ecran === 'chrono') return <Chronometre />
  if (ecran === 'borg') return <BorgReference />
  if (ecran === 'perfs') return <PerformancesEstimees />

  const items = [
    { id: 'vma', icone: Gauge, titre: 'Ma VMA', description: `Actuellement : ${storage.getVma(eleve) || '—'} km/h` },
    { id: 'compose', icone: TrendingUp, titre: 'Composer ma séance', description: 'Construire et réaliser une séance en solo' },
    { id: 'tests', icone: ListChecks, titre: 'Tests de VMA', description: 'Demi-Cooper, 4×3 min, Gacon (45/15)' },
    { id: 'chrono', icone: Timer, titre: 'Chronomètre', description: 'Temps et vitesse moyenne' },
    { id: 'borg', icone: Smile, titre: 'Échelle de Borg', description: 'Repères de ressenti d\'effort' },
    { id: 'perfs', icone: TrendingUp, titre: 'Performances estimées', description: 'Temps estimés par distance selon ta VMA' }
  ]

  function handleClick(id) {
    if (id === 'compose') onComposerSeance()
    else setEcran(id)
  }

  return (
    <div className="max-w-md mx-auto px-6 py-8">
      <h2 className="font-display text-2xl text-piste-900 mb-6 text-center">Outils</h2>

      {ecran === 'menu' && (
        <div className="space-y-3 mb-6">
          {items.map(({ id, icone: Icone, titre, description }) =>
            id === 'vma' ? (
              <div key={id} className="bg-piste-50 rounded-xl px-4 py-3.5">
                <div className="flex items-center gap-3 mb-2">
                  <Icone size={18} className="text-piste-600" />
                  <p className="text-sm font-medium text-piste-900">{titre}</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={vma}
                    onChange={(e) => setVma(e.target.value)}
                    placeholder="km/h"
                    className="w-24 rounded-lg border border-piste-200 px-2 py-1.5 text-sm"
                  />
                  <button onClick={enregistrerVma} className="text-xs font-medium bg-piste-800 text-white px-3 py-1.5 rounded-full">
                    Enregistrer
                  </button>
                </div>
              </div>
            ) : (
              <button
                key={id}
                onClick={() => handleClick(id)}
                className="w-full flex items-center justify-between bg-white border border-piste-100 rounded-xl px-4 py-3.5 hover:border-piste-300 transition"
              >
                <div className="flex items-center gap-3 text-left">
                  <Icone size={18} className="text-piste-600 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-piste-900">{titre}</p>
                    <p className="text-xs text-piste-500">{description}</p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-piste-400 shrink-0" />
              </button>
            )
          )}
        </div>
      )}
    </div>
  )
}
