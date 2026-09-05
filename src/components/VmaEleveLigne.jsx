import { useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { storage } from '../utils/storage'

const LABEL_TEST = { cooper: 'Demi-Cooper', '4x3': '4×3 min', gacon: 'Gacon 45/15' }

function formatDate(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}

export default function VmaEleveLigne({ eleve, onChange }) {
  const [valeur, setValeur] = useState('')
  const detail = storage.getVmaDetail(eleve)
  const retenue = detail.manuelle ?? detail.auto ?? null
  const source = detail.manuelle != null ? 'manuel' : detail.auto != null ? 'auto' : null

  function fixer() {
    const v = Number(valeur)
    if (!v) return
    storage.definirVmaManuelle(eleve, v)
    setValeur('')
    onChange()
  }

  function revenirAuto() {
    storage.effacerVmaManuelle(eleve)
    onChange()
  }

  return (
    <div className="bg-piste-50 rounded-xl px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-piste-900">
          {eleve.prenom} {eleve.nom}
        </p>
        <div className="text-right">
          <p className="font-display text-lg text-piste-900">{retenue ? `${retenue} km/h` : '—'}</p>
          {source && (
            <p className="text-[10px] text-piste-500">
              {source === 'manuel'
                ? `Fixée par le prof · ${formatDate(detail.manuelleDate)}`
                : `Test ${LABEL_TEST[detail.autoTest] || ''} · ${formatDate(detail.autoDate)}`}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="number"
          step="0.1"
          value={valeur}
          onChange={(e) => setValeur(e.target.value)}
          placeholder="Nouvelle VMA"
          className="w-28 rounded-lg border border-piste-200 px-2.5 py-1.5 text-sm"
        />
        <button onClick={fixer} className="text-xs font-medium bg-piste-800 text-white px-3 py-1.5 rounded-full">
          Fixer
        </button>
        {detail.manuelle != null && detail.auto != null && (
          <button onClick={revenirAuto} className="flex items-center gap-1 text-[11px] text-piste-500 underline">
            <RotateCcw size={11} /> Revenir au test ({detail.auto} km/h)
          </button>
        )}
      </div>
    </div>
  )
}
