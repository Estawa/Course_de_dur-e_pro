import { useState } from 'react'
import FullPowerBuilder from './FullPowerBuilder'
import { MODES_GUIDAGE } from '../utils/guidage'

export default function SeanceVierge({ modeParDefaut = 'mixte', onLancer }) {
  const [titre, setTitre] = useState('')
  const [modeGuidage, setModeGuidage] = useState(modeParDefaut)
  const [structure, setStructure] = useState(null)

  const pretALancer = structure && structure.sequence.length > 0

  return (
    <div className="max-w-md mx-auto px-6 py-6">
      <h2 className="font-display text-2xl text-piste-900 mb-1 text-center">Séance vierge</h2>
      <p className="text-sm text-piste-600 mb-6 text-center">Construis ta propre séance et réalise-la en solo.</p>

      <div className="mb-5">
        <label className="block text-sm font-medium text-piste-800 mb-1">Titre (optionnel)</label>
        <input
          value={titre}
          onChange={(e) => setTitre(e.target.value)}
          placeholder="Ex : Ma séance du mercredi"
          className="w-full rounded-xl border border-piste-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-piste-500"
        />
      </div>

      <FullPowerBuilder structureInitiale={structure} onChange={setStructure} />

      <div className="mt-5">
        <label className="block text-sm font-medium text-piste-800 mb-1">Guidage de l'allure</label>
        <select
          value={modeGuidage}
          onChange={(e) => setModeGuidage(e.target.value)}
          className="w-full rounded-xl border border-piste-200 px-3 py-2.5 text-sm bg-white"
        >
          {Object.entries(MODES_GUIDAGE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <button
        disabled={!pretALancer}
        onClick={() =>
          onLancer({
            titre: titre.trim() || 'Séance libre',
            modeGuidage,
            niveau: {
              id: crypto.randomUUID(),
              nom: 'Séance libre',
              blocs: [{ id: crypto.randomUUID(), mode: 'fullpower', structure }]
            }
          })
        }
        className="w-full bg-piste-800 hover:bg-piste-700 disabled:opacity-40 text-white font-medium py-3.5 rounded-xl transition active:scale-[0.98] mt-6"
      >
        Lancer ma séance
      </button>
    </div>
  )
}
