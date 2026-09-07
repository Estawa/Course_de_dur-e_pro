import { useState } from 'react'
import { storage } from '../utils/storage'

const LABEL_TEST = { cooper: 'Demi-Cooper', '4x3': '4×3 min', gacon: 'Gacon 45/15' }

function formatDate(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}

// Résumé lisible du détail brut d'un test, selon son type.
function resumeDetail(derniereCourse) {
  if (!derniereCourse || !derniereCourse.detail) return null
  const { test, detail } = derniereCourse
  if (test === '4x3' && Array.isArray(detail.distances)) {
    return detail.distances.map((d, i) => `Rép. ${i + 1} : ${d} m`).join(' · ')
  }
  if (test === 'cooper' && detail.distance != null) {
    return `${detail.distance} m en 6 min`
  }
  if (test === 'gacon' && detail.palier != null) {
    return `Palier ${detail.palier} atteint`
  }
  return null
}

export default function VmaEleveLigne({ eleve, onChange }) {
  const [valeur, setValeur] = useState('')
  const detail = storage.getVmaDetail(eleve)
  const retenue = storage.getVmaRetenue(eleve)
  const actif = detail.retenueSource ?? (detail.manuelle != null ? 'manuelle' : detail.auto != null ? 'auto' : null)
  const resume = resumeDetail(detail.derniereCourse)

  function fixer() {
    const v = Number(valeur)
    if (!v) return
    storage.definirVmaManuelle(eleve, v)
    setValeur('')
    onChange()
  }

  function activer(source) {
    storage.activerSourceVma(eleve, source)
    onChange()
  }

  return (
    <div className="bg-piste-50 rounded-xl px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-piste-900">
          {eleve.prenom} {eleve.nom}
        </p>
        <p className="font-display text-lg text-piste-900">{retenue ? `${retenue} km/h` : '—'}</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label
          className={`flex items-start gap-2 rounded-lg border px-2.5 py-2 ${
            detail.auto == null ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
          } ${actif === 'auto' ? 'border-piste-800 bg-white' : 'border-piste-200'}`}
        >
          <input
            type="radio"
            className="mt-0.5"
            checked={actif === 'auto'}
            disabled={detail.auto == null}
            onChange={() => activer('auto')}
          />
          <span>
            <span className="block text-[10px] uppercase tracking-wide text-piste-500">VMA test</span>
            <span className="block font-display text-sm text-piste-900">
              {detail.auto != null ? `${detail.auto} km/h` : '—'}
            </span>
            {detail.auto != null && (
              <span className="block text-[10px] text-piste-500">
                {LABEL_TEST[detail.autoTest] || ''} · {formatDate(detail.autoDate)}
              </span>
            )}
          </span>
        </label>

        <label
          className={`flex items-start gap-2 rounded-lg border px-2.5 py-2 ${
            detail.manuelle == null ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
          } ${actif === 'manuelle' ? 'border-piste-800 bg-white' : 'border-piste-200'}`}
        >
          <input
            type="radio"
            className="mt-0.5"
            checked={actif === 'manuelle'}
            disabled={detail.manuelle == null}
            onChange={() => activer('manuelle')}
          />
          <span>
            <span className="block text-[10px] uppercase tracking-wide text-piste-500">VMA imposée</span>
            <span className="block font-display text-sm text-piste-900">
              {detail.manuelle != null ? `${detail.manuelle} km/h` : '—'}
            </span>
            {detail.manuelle != null && (
              <span className="block text-[10px] text-piste-500">Fixée le {formatDate(detail.manuelleDate)}</span>
            )}
          </span>
        </label>
      </div>

      {resume && <p className="text-[11px] text-piste-500 mt-2">{resume}</p>}

      <div className="flex items-center gap-2 flex-wrap mt-2">
        <input
          type="number"
          step="0.1"
          value={valeur}
          onChange={(e) => setValeur(e.target.value)}
          placeholder="Nouvelle VMA imposée"
          className="w-32 rounded-lg border border-piste-200 px-2.5 py-1.5 text-sm"
        />
        <button onClick={fixer} className="text-xs font-medium bg-piste-800 text-white px-3 py-1.5 rounded-full">
          Fixer
        </button>
      </div>
    </div>
  )
}
