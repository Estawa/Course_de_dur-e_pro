import { useState } from 'react'
import { Users, X } from 'lucide-react'
import { storage } from '../utils/storage'
import { verifierCompatibiliteBinome, ECART_VMA_MAX_BINOME } from '../utils/binome'

// Encart de l'aperçu de séance : permet à l'élève qui a son téléphone (A) d'ajouter un camarade
// sans téléphone (B). B confirme sa présence en tapant son propre code PIN sur le téléphone de A
// (empêche de créditer un élève absent). Seuls les élèves de la même classe sont proposés, et
// les deux VMA doivent être proches (voir ECART_VMA_MAX_BINOME).
export default function BinomeChoix({ eleve, vmaPorteur, binome, onChoisir, onRetirer }) {
  const [ouvert, setOuvert] = useState(false)
  const [idChoisi, setIdChoisi] = useState('')
  const [pin, setPin] = useState('')
  const [erreur, setErreur] = useState('')

  if (!eleve) return null

  if (binome) {
    return (
      <div className="border-2 border-piste-500 bg-piste-50 rounded-xl px-4 py-3 mb-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            <Users size={18} className="text-piste-700 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-piste-900">En binôme avec {binome.eleve.prenom} {binome.eleve.nom}</p>
              {binome.vmaGuidage != null && (
                <p className="text-xs text-piste-600 mt-0.5">
                  Allures calculées sur votre VMA moyenne ({binome.vmaGuidage} km/h). Restez ensemble du début à la fin.
                </p>
              )}
            </div>
          </div>
          <button onClick={onRetirer} className="text-xs text-piste-500 underline shrink-0">Retirer</button>
        </div>
      </div>
    )
  }

  const camarades = storage.getElevesClasse(eleve.classe).filter((e) => e.id !== eleve.id)

  function fermer() {
    setOuvert(false)
    setIdChoisi('')
    setPin('')
    setErreur('')
  }

  function valider() {
    setErreur('')
    const b = storage.trouverEleve(eleve.classe, idChoisi)
    if (!b) return setErreur('Choisis ton binôme dans la liste.')
    if (!b.pin) return setErreur(`${b.prenom} n'a pas encore créé son code PIN : il doit d'abord se connecter une fois à l'application.`)
    if (!storage.verifierPin(eleve.classe, b.id, pin)) return setErreur('Code PIN incorrect.')
    const eleveB = { id: b.id, nom: b.nom, prenom: b.prenom, classe: eleve.classe, teacherId: eleve.teacherId }
    const vmaB = storage.getVmaRetenue(eleveB)
    const compat = verifierCompatibiliteBinome(vmaPorteur, vmaB)
    if (!compat.ok) return setErreur(compat.raison)
    onChoisir({ eleve: eleveB, vma: vmaB, vmaPorteur, vmaGuidage: compat.vmaGuidage })
    fermer()
  }

  return (
    <>
      <button
        onClick={() => setOuvert(true)}
        className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-piste-200 text-piste-700 rounded-xl px-4 py-3 mb-4 text-sm font-medium hover:bg-piste-50"
      >
        <Users size={16} /> Courir avec un binôme sans téléphone
      </button>

      {ouvert && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <p className="font-display text-lg text-piste-900">Ajouter un binôme</p>
              <button onClick={fermer} className="p-1 text-piste-400"><X size={18} /></button>
            </div>
            <p className="text-xs text-piste-600 mb-4">
              Ton camarade court avec toi pendant toute la séance, guidé par ton téléphone. Sa séance lui sera créditée si
              vous la réussissez tous les deux ; sinon, c'est votre professeur qui décidera. Vos VMA doivent être proches
              (écart de {ECART_VMA_MAX_BINOME} km/h maximum).
            </p>

            <label className="block text-xs font-medium text-piste-700 mb-1">Ton binôme</label>
            <select
              value={idChoisi}
              onChange={(e) => setIdChoisi(e.target.value)}
              className="w-full rounded-xl border border-piste-200 px-3 py-2.5 text-sm mb-3 bg-white"
            >
              <option value="">Choisir…</option>
              {camarades.map((c) => (
                <option key={c.id} value={c.id}>{c.nom} {c.prenom}</option>
              ))}
            </select>

            <label className="block text-xs font-medium text-piste-700 mb-1">Son code PIN (à taper par lui)</label>
            <input
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full rounded-xl border border-piste-200 px-3 py-2.5 text-sm mb-3 tracking-widest"
              placeholder="••••"
            />

            {erreur && <p className="text-xs text-alerte mb-3">{erreur}</p>}

            <button
              disabled={!idChoisi || !pin}
              onClick={valider}
              className="w-full bg-piste-800 hover:bg-piste-700 disabled:opacity-40 text-white font-medium py-3 rounded-xl transition active:scale-[0.98]"
            >
              Valider le binôme
            </button>
          </div>
        </div>
      )}
    </>
  )
}
