import { useState } from 'react'
import { formatDuree } from '../utils/calc'

// Coefficients %VMA soutenables par distance (estimation courante en préparation course à pied)
const DISTANCES = [
  { label: '1 km', metres: 1000, pctVma: 0.95 },
  { label: '5 km', metres: 5000, pctVma: 0.87 },
  { label: '10 km', metres: 10000, pctVma: 0.82 },
  { label: 'Semi-marathon', metres: 21097, pctVma: 0.77 },
  { label: 'Marathon', metres: 42195, pctVma: 0.72 }
]

export default function PerformancesEstimees() {
  const [vma, setVma] = useState('')

  const vmaNum = Number(vma)

  return (
    <div className="max-w-md mx-auto px-6 py-8">
      <h2 className="font-display text-2xl text-piste-900 mb-1 text-center">Performances estimées</h2>
      <p className="text-sm text-piste-600 mb-6 text-center">À partir de ta VMA, une estimation de temps sur différentes distances.</p>

      <div className="mb-6">
        <label className="block text-sm font-medium text-piste-800 mb-1">VMA (km/h)</label>
        <input
          type="number"
          value={vma}
          onChange={(e) => setVma(e.target.value)}
          className="w-full rounded-xl border border-piste-200 px-4 py-3 text-center text-lg focus:outline-none focus:ring-2 focus:ring-piste-500"
          placeholder="Ex : 15"
        />
      </div>

      {vmaNum > 0 && (
        <div className="space-y-2 mb-6">
          {DISTANCES.map((d) => {
            const vitesse = vmaNum * d.pctVma
            const tempsSec = (d.metres / 1000 / vitesse) * 3600
            return (
              <div key={d.label} className="flex items-center justify-between bg-piste-50 rounded-xl px-4 py-3">
                <span className="text-sm font-medium text-piste-800">{d.label}</span>
                <span className="font-display text-lg text-piste-900">{formatDuree(tempsSec)}</span>
              </div>
            )
          })}
        </div>
      )}

      <div className="border-t border-piste-100 pt-4">
        <p className="text-xs text-piste-500 mb-2">Ou saisis une performance réalisée pour connaître le %VMA correspondant :</p>
        <PerformanceInverse vma={vmaNum} />
      </div>
    </div>
  )
}

function PerformanceInverse({ vma }) {
  const [km, setKm] = useState('')
  const [m, setM] = useState('')
  const [h, setH] = useState('')
  const [min, setMin] = useState('')
  const [sec, setSec] = useState('')

  const distanceKm = (Number(km) || 0) + (Number(m) || 0) / 1000
  const dureeH = (Number(h) || 0) + (Number(min) || 0) / 60 + (Number(sec) || 0) / 3600
  const vitesse = dureeH > 0 ? distanceKm / dureeH : 0
  const pctVma = vma > 0 && vitesse > 0 ? Math.round((vitesse / vma) * 100) : null

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input type="number" value={km} onChange={(e) => setKm(e.target.value)} placeholder="km" className="w-full rounded-lg border border-piste-200 px-2 py-1.5 text-sm" />
        <input type="number" value={m} onChange={(e) => setM(e.target.value)} placeholder="m" className="w-full rounded-lg border border-piste-200 px-2 py-1.5 text-sm" />
      </div>
      <div className="flex gap-2">
        <input type="number" value={h} onChange={(e) => setH(e.target.value)} placeholder="h" className="w-full rounded-lg border border-piste-200 px-2 py-1.5 text-sm" />
        <input type="number" value={min} onChange={(e) => setMin(e.target.value)} placeholder="min" className="w-full rounded-lg border border-piste-200 px-2 py-1.5 text-sm" />
        <input type="number" value={sec} onChange={(e) => setSec(e.target.value)} placeholder="sec" className="w-full rounded-lg border border-piste-200 px-2 py-1.5 text-sm" />
      </div>
      {pctVma && (
        <p className="text-sm text-piste-800">Effort réalisé à environ <span className="font-display">{pctVma}%</span> de la VMA</p>
      )}
    </div>
  )
}
