import { useState } from 'react'
import ListeSeries, { serieFullPowerVide } from './ListeSeries'
import { MODES_GUIDAGE } from '../utils/guidage'
import { totauxNiveau } from '../utils/fullpower'
import { formatDuree } from '../utils/calc'
import { RECUPERATION_FIXE } from '../utils/phasesFixes'

// Séance vierge : l'élève construit sa propre séance en une suite de séries (Série 1, Série 2…),
// chacune avec ses propres répétitions, son nombre de tours et ses récupérations, puis la réalise
// en solo (mêmes bilans de série, Borg et observation que les séances de la bibliothèque).
export default function SeanceVierge({ modeParDefaut = 'mixte', onLancer }) {
  const [titre, setTitre] = useState('')
  const [modeGuidage, setModeGuidage] = useState(modeParDefaut)
  const [series, setSeries] = useState(() => [serieFullPowerVide()])

  const pretALancer = series.length > 0 && series.every((b) => b.structure?.sequence?.some((s) => Number(s.repetitions) > 0))
  const niveauProvisoire = { nom: 'Séance libre', blocs: series }
  const { duree, travail } = totauxNiveau(niveauProvisoire, 15, RECUPERATION_FIXE.duree_s)

  return (
    <div className="max-w-md mx-auto px-6 py-6">
      <h2 className="font-display text-2xl text-piste-900 mb-1 text-center">Séance vierge</h2>
      <p className="text-sm text-piste-600 mb-6 text-center">Construis ta propre séance, partie par partie, et réalise-la en solo.</p>

      <div className="mb-5">
        <label className="block text-sm font-medium text-piste-800 mb-1">Titre (optionnel)</label>
        <input
          value={titre}
          onChange={(e) => setTitre(e.target.value)}
          placeholder="Ex : Ma séance du mercredi"
          className="w-full rounded-xl border border-piste-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-piste-500"
        />
      </div>

      <ListeSeries series={series} onChange={setSeries} avecModeSimple={false} />

      <div className="grid grid-cols-2 gap-2 mt-5">
        <div className="bg-piste-50 rounded-lg px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-piste-500">Temps de travail</p>
          <p className="font-display text-base text-piste-900 tabular-nums">{formatDuree(travail)}</p>
        </div>
        <div className="bg-piste-50 rounded-lg px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-piste-500">Durée totale</p>
          <p className="font-display text-base text-piste-900 tabular-nums">{formatDuree(duree)}</p>
        </div>
      </div>

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

      {!pretALancer && (
        <p className="text-xs text-alerte mt-4 text-center">Chaque partie doit contenir au moins une répétition.</p>
      )}

      <button
        disabled={!pretALancer}
        onClick={() =>
          onLancer({
            titre: titre.trim() || 'Séance libre',
            modeGuidage,
            niveau: {
              id: crypto.randomUUID(),
              nom: 'Séance libre',
              blocs: series.map((b) => ({ id: b.id, mode: 'fullpower', structure: b.structure }))
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
