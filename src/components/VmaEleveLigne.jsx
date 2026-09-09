import { useState } from 'react'
import { Star } from 'lucide-react'
import { storage } from '../utils/storage'

const LABEL_TEST = { cooper: 'Demi-Cooper', '4x3': '4×3 min', gacon: 'Gacon 45/15', vameval: 'VAM-EVAL' }

function formatDate(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}

// Résumé lisible du détail brut d'un test, selon son type.
function resumeDetail(test, detail) {
  if (!detail) return null
  if (test === '4x3' && Array.isArray(detail.distances)) {
    return detail.distances.map((d, i) => `Rép. ${i + 1} : ${d} m`).join(' · ')
  }
  if (test === 'cooper' && detail.distance != null) {
    return `${detail.distance} m en 6 min`
  }
  if (test === 'gacon' && detail.palier != null) {
    return `Palier ${detail.palier} atteint`
  }
  if (test === 'vameval' && detail.palier != null) {
    const gps = detail.viaGPS ? '· vérifié GPS' : '· non vérifié (GPS indispo)'
    return `Palier ${detail.palier} · ${detail.distanceDansPalier}/${detail.distanceRequise} m ${gps}`
  }
  return null
}

export default function VmaEleveLigne({ eleve, onChange }) {
  const [valeur, setValeur] = useState('')
  const [historiqueOuvert, setHistoriqueOuvert] = useState(false)
  const detail = storage.getVmaDetail(eleve)
  const retenue = storage.getVmaRetenue(eleve)
  const historique = storage.getHistoriqueTests(eleve)
  const meilleurEstRetenu = detail.manuelle == null

  function fixer() {
    const v = Number(valeur)
    if (!v) return
    storage.definirVmaManuelle(eleve, v)
    setValeur('')
    onChange()
  }

  function retenirTest(entree) {
    storage.definirVmaManuelle(eleve, entree.valeur)
    onChange()
  }

  function revenirAuMeilleurTest() {
    storage.effacerVmaManuelle(eleve)
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
        <div className={`rounded-lg border px-2.5 py-2 ${meilleurEstRetenu ? 'border-piste-800 bg-white' : 'border-piste-200'}`}>
          <span className="block text-[10px] uppercase tracking-wide text-piste-500">Meilleur test</span>
          <span className="block font-display text-sm text-piste-900">
            {detail.auto != null ? `${detail.auto} km/h` : '—'}
          </span>
          {detail.auto != null && (
            <span className="block text-[10px] text-piste-500">
              {LABEL_TEST[detail.autoTest] || ''} · {formatDate(detail.autoDate)}
            </span>
          )}
        </div>

        <div className={`rounded-lg border px-2.5 py-2 ${!meilleurEstRetenu ? 'border-piste-800 bg-white' : 'border-piste-200'}`}>
          <span className="block text-[10px] uppercase tracking-wide text-piste-500">VMA imposée</span>
          <span className="block font-display text-sm text-piste-900">
            {detail.manuelle != null ? `${detail.manuelle} km/h` : '—'}
          </span>
          {detail.manuelle != null && (
            <span className="block text-[10px] text-piste-500">Fixée le {formatDate(detail.manuelleDate)}</span>
          )}
        </div>
      </div>

      {!meilleurEstRetenu && detail.auto != null && (
        <button onClick={revenirAuMeilleurTest} className="text-[11px] text-piste-500 underline mt-2">
          Revenir au meilleur test ({detail.auto} km/h)
        </button>
      )}

      {historique.length > 0 && (
        <div className="mt-2">
          <button
            onClick={() => setHistoriqueOuvert((v) => !v)}
            className="text-[11px] text-piste-600 underline"
          >
            {historiqueOuvert ? 'Masquer' : 'Voir'} l'historique des tests ({historique.length})
          </button>
          {historiqueOuvert && (
            <div className="mt-2 space-y-1.5">
              {historique.map((h, i) => (
                <div key={i} className="flex items-center justify-between bg-white rounded-lg px-2.5 py-1.5 border border-piste-100">
                  <div>
                    <p className="text-xs text-piste-900">
                      <span className="font-medium">{h.valeur} km/h</span> · {LABEL_TEST[h.test] || h.test} · {formatDate(h.date)}
                    </p>
                    {resumeDetail(h.test, h.detail) && (
                      <p className="text-[10px] text-piste-500">{resumeDetail(h.test, h.detail)}</p>
                    )}
                  </div>
                  <button
                    onClick={() => retenirTest(h)}
                    title="Fixer cette valeur comme VMA retenue"
                    className={`shrink-0 p-1.5 rounded-full ${
                      detail.manuelle === h.valeur ? 'text-piste-800' : 'text-piste-300 hover:text-piste-600'
                    }`}
                  >
                    <Star size={14} fill={detail.manuelle === h.valeur ? 'currentColor' : 'none'} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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
