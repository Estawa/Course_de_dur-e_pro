import { Flame, Layers, MapPin, Timer as TimerIcon } from 'lucide-react'
import { formatDuree, vitesseVersAllure } from '../utils/calc'
import { totauxNiveau } from '../utils/fullpower'

function detailBlocSimple(b) {
  return [`${b.distance_m} m en ${formatDuree(b.duree_s)} (${vitesseVersAllure(b.allure_kmh)})`]
}

function detailBlocFullPower(b, vmaRef) {
  const s = b.structure
  if (!s) return []
  const lignes = s.sequence.map((item) => {
    const type = s.types.find((t) => t.id === item.typeId)
    if (!type) return null
    const vTravail = vmaRef ? Math.round((type.pct_vma_travail / 100) * vmaRef * 100) / 100 : null
    const vRecup = vmaRef ? Math.round((type.pct_vma_recup / 100) * vmaRef * 100) / 100 : null
    const travail = `${formatDuree(type.duree_travail_s)} à ${type.pct_vma_travail}% VMA${vTravail ? ` (${vitesseVersAllure(vTravail)})` : ''}`
    const recup =
      type.duree_recup_s > 0
        ? ` + ${formatDuree(type.duree_recup_s)} récup à ${type.pct_vma_recup}% VMA${vRecup ? ` (${vitesseVersAllure(vRecup)})` : ''}`
        : ''
    return `Type ${type.lettre} × ${item.repetitions} : ${travail}${recup}`
  }).filter(Boolean)
  if (s.nbTours > 1) lignes.push(`Séquence répétée ${s.nbTours} fois (séries)`)
  if (s.recupSerie?.active && s.nbTours > 1) lignes.push(`Récupération entre séries : ${formatDuree(s.recupSerie.duree_s)} à ${s.recupSerie.pct_vma}% VMA`)
  if (s.recupFinale?.active) lignes.push(`Récupération / retour au calme final : ${formatDuree(s.recupFinale.duree_s)} à ${s.recupFinale.pct_vma}% VMA`)
  return lignes
}

export default function ApercuSeance({ niveau, seanceTitre, vmaRef, onDemarrer }) {
  const { distance, duree } = totauxNiveau(niveau, vmaRef)

  return (
    <div className="max-w-md mx-auto px-6 py-6">
      <p className="text-xs uppercase tracking-wide text-piste-500 mb-1 text-center">{seanceTitre}</p>
      <h2 className="font-display text-2xl text-piste-900 mb-4 text-center">{niveau.nom}</h2>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-piste-50 rounded-xl px-3 py-3 flex items-center gap-2">
          <MapPin size={16} className="text-piste-600 shrink-0" />
          <span className="text-sm text-piste-800">~{distance} m au total</span>
        </div>
        <div className="bg-piste-50 rounded-xl px-3 py-3 flex items-center gap-2">
          <TimerIcon size={16} className="text-piste-600 shrink-0" />
          <span className="text-sm text-piste-800">{formatDuree(duree)} au total</span>
        </div>
      </div>

      {niveau.echauffement?.active && (
        <div className="flex items-start gap-2 bg-[#f7f2e8] rounded-xl px-4 py-3 mb-3">
          <Flame size={16} className="text-cendre shrink-0 mt-0.5" />
          <p className="text-sm text-piste-800">Échauffement : {formatDuree(niveau.echauffement.duree_s)}</p>
        </div>
      )}

      <div className="space-y-3 mb-8">
        {niveau.blocs.map((b, i) => (
          <div key={b.id} className="border border-piste-100 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Layers size={14} className="text-piste-500" />
              <p className="text-xs font-semibold uppercase tracking-wide text-piste-500">Bloc {i + 1}</p>
            </div>
            <ul className="space-y-1">
              {(b.mode === 'fullpower' ? detailBlocFullPower(b, vmaRef) : detailBlocSimple(b)).map((ligne, j) => (
                <li key={j} className="text-sm text-piste-800">{ligne}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <button
        onClick={onDemarrer}
        className="w-full bg-piste-800 hover:bg-piste-700 text-white font-medium py-3.5 rounded-xl transition active:scale-[0.98]"
      >
        C'est parti
      </button>
    </div>
  )
}
