import { Flame, Info, Layers, MapPin, Timer as TimerIcon } from 'lucide-react'
import { formatDuree, vitesseVersAllure, vitesseVersTemps50m } from '../utils/calc'
import { totauxNiveau, dureeRecuperationFinale } from '../utils/fullpower'
import { libelleNiveau } from '../utils/niveauLabels'
import { RECUPERATION_FIXE } from '../utils/phasesFixes'
import BinomeChoix from './BinomeChoix'
import { MODES_GUIDAGE, SEUIL_RETOUR_DEPART_S } from '../utils/guidage'

function allureEtRepere(kmh) {
  return `${vitesseVersAllure(kmh)} · ${vitesseVersTemps50m(kmh)}`
}

function detailBlocSimple(b) {
  return [`${b.distance_m} m en ${formatDuree(b.duree_s)} (${allureEtRepere(b.allure_kmh)})`]
}

function detailBlocFullPower(b, vmaRef, masquerRecupFinale) {
  const s = b.structure
  if (!s) return []
  const lignes = s.sequence.map((item) => {
    const type = s.types.find((t) => t.id === item.typeId)
    if (!type) return null
    const vTravail = vmaRef ? Math.round((type.pct_vma_travail / 100) * vmaRef * 100) / 100 : null
    const vRecup = vmaRef ? Math.round((type.pct_vma_recup / 100) * vmaRef * 100) / 100 : null
    const travail = `${formatDuree(type.duree_travail_s)} à ${type.pct_vma_travail}% VMA${vTravail ? ` (${allureEtRepere(vTravail)})` : ''}`
    const recup =
      type.duree_recup_s > 0
        ? ` + ${formatDuree(type.duree_recup_s)} récup à ${type.pct_vma_recup}% VMA${vRecup ? ` (${allureEtRepere(vRecup)})` : ''}`
        : ''
    return `Type ${type.lettre} × ${item.repetitions} : ${travail}${recup}`
  }).filter(Boolean)
  if (s.nbTours > 1) lignes.push(`Séquence répétée ${s.nbTours} fois (séries)`)
  if (s.recupSerie?.active && s.nbTours > 1) lignes.push(`Récupération entre séries : ${formatDuree(s.recupSerie.duree_s)} à ${s.recupSerie.pct_vma}% VMA`)
  // La récupération finale de ce bloc, si c'est le dernier du niveau, est déjà annoncée par la
  // ligne "Récupération finale" séance-level ci-dessus (voir dureeRecuperationFinale) — pas
  // besoin de la répéter ici, ce serait justement le doublon qu'on a supprimé.
  if (s.recupFinale?.active && !masquerRecupFinale) lignes.push(`Récupération / retour au calme final : ${formatDuree(s.recupFinale.duree_s)} à ${s.recupFinale.pct_vma}% VMA`)
  return lignes
}

export default function ApercuSeance({ niveau, seanceTitre, vmaRef: vmaPerso, regleParticuliere, modeGuidage, eleve, binome, onChoisirBinome, onRetirerBinome, onDemarrer }) {
  // En binôme, les allures affichées sont celles du guidage (VMA moyenne des deux élèves).
  const vmaRef = binome ? binome.vmaGuidage : vmaPerso
  const { distance, duree } = totauxNiveau(niveau, vmaRef, RECUPERATION_FIXE.duree_s)
  const dureeRecupFinale = dureeRecuperationFinale(niveau, RECUPERATION_FIXE.duree_s)

  return (
    <div className="max-w-md mx-auto px-6 py-6">
      <p className="text-xs uppercase tracking-wide text-piste-500 mb-1 text-center">{seanceTitre}</p>
      <h2 className="font-display text-2xl text-piste-900 mb-4 text-center">{libelleNiveau(niveau.nom)}</h2>

      {regleParticuliere && (
        <div className="flex items-start gap-2 bg-[#eef4f1] rounded-xl px-4 py-3 mb-3">
          <Info size={16} className="text-piste-600 shrink-0 mt-0.5" />
          <p className="text-sm text-piste-800">{regleParticuliere}</p>
        </div>
      )}

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

      <div className="flex items-start gap-2 bg-[#eef4f1] rounded-xl px-4 py-3 mb-3">
        <TimerIcon size={16} className="text-piste-600 shrink-0 mt-0.5" />
        <p className="text-sm text-piste-800">Récupération finale : {formatDuree(dureeRecupFinale)}</p>
      </div>

      {modeGuidage && (
        <div className="bg-piste-50 rounded-xl px-4 py-3 mb-3 text-sm text-piste-800">
          <p>Guidage : {MODES_GUIDAGE[modeGuidage]}</p>
          <p className="text-xs text-piste-600 mt-1">
            {niveau.retourDepart === 'jamais'
              ? 'Les récupérations se font sur place.'
              : niveau.retourDepart === 'toujours'
              ? 'Retour à la ligne de départ pendant chaque récupération.'
              : `Retour à la ligne de départ pendant les récupérations de ${SEUIL_RETOUR_DEPART_S / 60} min ou plus.`}
            {' '}Tu calcules et saisis ta distance après chaque partie.
          </p>
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
              {(b.mode === 'fullpower' ? detailBlocFullPower(b, vmaRef, i === niveau.blocs.length - 1) : detailBlocSimple(b)).map((ligne, j) => (
                <li key={j} className="text-sm text-piste-800">{ligne}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {onChoisirBinome && (
        <BinomeChoix eleve={eleve} vmaPorteur={vmaPerso} binome={binome} onChoisir={onChoisirBinome} onRetirer={onRetirerBinome} />
      )}

      <button
        onClick={onDemarrer}
        className="w-full bg-piste-800 hover:bg-piste-700 text-white font-medium py-3.5 rounded-xl transition active:scale-[0.98]"
      >
        C'est parti
      </button>
    </div>
  )
}
