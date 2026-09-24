import { Users, Check, X, RotateCcw } from 'lucide-react'
import { STATUTS_BINOME, nomCourt } from '../utils/binome'

// Fiche de suivi (professeur) : informations sur une séance courue en binôme. Pour l'élève sans
// téléphone, le professeur valide ou refuse une séance "non validée" (un des deux n'a pas réussi
// toute la séance, ou le binôme a décroché) ; il peut aussi revenir sur sa décision. Seules les
// séances validées (d'office ou par le professeur) comptent dans la moyenne de cycle.
export default function ValidationBinome({ realisation, onModifier }) {
  const b = realisation.binome
  if (!b) return null

  if (b.role === 'porteur') {
    return (
      <p className="flex items-center gap-1 text-[11px] text-piste-500 mt-1">
        <Users size={12} /> A couru avec {nomCourt(b.partenaire)} (sans téléphone) sur son téléphone
      </p>
    )
  }

  const blocsDecroches = (realisation.blocsResultats || [])
    .map((bl, i) => (bl.binomePresent === false ? i + 1 : null))
    .filter(Boolean)
  const enAttente = b.statut === 'non_valide'
  const decisionProf = b.statut === 'valide_prof' || b.statut === 'refuse'

  function decider(statut) {
    onModifier?.(realisation.id, { binome: { ...b, statut, dateDecision: Date.now() } })
  }

  const couleur =
    b.statut === 'refuse' ? 'border-alerte/50 bg-[#fbeeea]' : enAttente ? 'border-cendre bg-[#f7f2e8]' : 'border-piste-200 bg-white'

  return (
    <div className={`mt-2 border rounded-lg px-2.5 py-2 ${couleur}`}>
      <p className="flex items-center gap-1 text-[11px] font-medium text-piste-900">
        <Users size={12} /> Binôme sur le téléphone de {nomCourt(b.partenaire)} · {STATUTS_BINOME[b.statut]}
      </p>
      <p className="text-[11px] text-piste-600 mt-0.5">
        {b.partenaire.prenom} : {b.reussitePorteur ? 'séance réussie' : 'séance non réussie'} · {realisation.eleve.prenom} :{' '}
        {b.reussiteBinome ? 'séance réussie' : 'séance non réussie'}
        {blocsDecroches.length > 0 && ` · a décroché au bloc ${blocsDecroches.join(', ')}`}
      </p>
      {(enAttente || b.statut === 'refuse') && (
        <p className="text-[11px] text-piste-500 mt-0.5">Ne compte pas dans la moyenne de cycle.</p>
      )}

      {onModifier && enAttente && (
        <div className="flex gap-1.5 mt-2">
          <button
            onClick={() => decider('valide_prof')}
            className="flex items-center gap-1 text-[11px] font-medium bg-piste-800 text-white rounded-full px-2.5 py-1"
          >
            <Check size={12} /> Valider
          </button>
          <button
            onClick={() => decider('refuse')}
            className="flex items-center gap-1 text-[11px] font-medium border border-alerte/60 text-alerte rounded-full px-2.5 py-1"
          >
            <X size={12} /> Refuser
          </button>
        </div>
      )}
      {onModifier && b.statut === 'valide' && (
        <button
          onClick={() => decider('refuse')}
          className="flex items-center gap-1 text-[11px] font-medium text-piste-500 hover:text-alerte mt-1.5"
        >
          <X size={12} /> Refuser quand même
        </button>
      )}
      {onModifier && decisionProf && (
        <button
          onClick={() => decider('non_valide')}
          className="flex items-center gap-1 text-[11px] font-medium text-piste-600 mt-1.5"
        >
          <RotateCcw size={12} /> Annuler ma décision
        </button>
      )}
    </div>
  )
}
