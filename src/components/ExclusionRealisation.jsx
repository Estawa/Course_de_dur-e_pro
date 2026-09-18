import { useState } from 'react'
import { Ban, RotateCcw } from 'lucide-react'

// Permet au professeur d'exclure une séance de la moyenne de cycle d'un élève (souci de santé
// avéré, contexte particulier...), avec un motif en texte libre. Réversible à tout moment. La
// séance reste visible dans l'historique et son détail consultable — seule la moyenne de cycle
// (utils/calc.js → syntheseCycle) l'ignore tant qu'elle est exclue.
export default function ExclusionRealisation({ realisation, onModifier }) {
  const [motifOuvert, setMotifOuvert] = useState(false)
  const [motif, setMotif] = useState(realisation.motifExclusion || '')
  const exclue = !!realisation.exclureCycle

  function exclure() {
    if (!motif.trim()) {
      setMotifOuvert(true)
      return
    }
    onModifier(realisation.id, { exclureCycle: true, motifExclusion: motif.trim() })
    setMotifOuvert(false)
  }

  function reintegrer() {
    onModifier(realisation.id, { exclureCycle: false })
  }

  if (exclue) {
    return (
      <div className="mt-2 pt-2 border-t border-piste-100 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-alerte">Exclue de la note de cycle</p>
          {realisation.motifExclusion && <p className="text-[11px] text-piste-500 truncate">{realisation.motifExclusion}</p>}
        </div>
        <button
          onClick={reintegrer}
          className="flex items-center gap-1 text-[11px] font-medium text-piste-700 border border-piste-200 rounded-full px-2.5 py-1 hover:bg-piste-50 shrink-0"
        >
          <RotateCcw size={12} /> Réintégrer
        </button>
      </div>
    )
  }

  return (
    <div className="mt-2 pt-2 border-t border-piste-100">
      {!motifOuvert && (
        <button
          onClick={() => setMotifOuvert(true)}
          className="flex items-center gap-1 text-[11px] font-medium text-piste-500 hover:text-alerte"
        >
          <Ban size={12} /> Exclure de la note de cycle
        </button>
      )}
      {motifOuvert && (
        <div className="flex items-center gap-1.5">
          <input
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            placeholder="Motif (ex : blessure, certificat médical...)"
            autoFocus
            className="flex-1 rounded-lg border border-piste-200 px-2.5 py-1.5 text-xs"
          />
          <button onClick={exclure} className="text-xs font-medium bg-alerte text-white px-2.5 py-1.5 rounded-lg shrink-0">
            Exclure
          </button>
        </div>
      )}
    </div>
  )
}
