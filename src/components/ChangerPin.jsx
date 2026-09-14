import { useState } from 'react'
import { KeyRound, Check, X } from 'lucide-react'

// pinActuel : accesConfig.pinAdmin (Firebase). onChanger(nouveauPin) persiste le changement.
export default function ChangerPin({ pinActuel, onChanger }) {
  const [ouvert, setOuvert] = useState(false)
  const [actuel, setActuel] = useState('')
  const [nouveau, setNouveau] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [message, setMessage] = useState('')
  const [erreur, setErreur] = useState(false)

  function reinitialiserChamps() {
    setActuel('')
    setNouveau('')
    setConfirmation('')
    setMessage('')
    setErreur(false)
  }

  function valider(e) {
    e.preventDefault()
    if (actuel !== pinActuel) {
      setErreur(true)
      setMessage('Code actuel incorrect.')
      return
    }
    if (!/^\d{4,6}$/.test(nouveau)) {
      setErreur(true)
      setMessage('Le nouveau code doit contenir de 4 à 6 chiffres.')
      return
    }
    if (nouveau !== confirmation) {
      setErreur(true)
      setMessage('Les deux saisies du nouveau code ne correspondent pas.')
      return
    }
    onChanger(nouveau)
    setErreur(false)
    setMessage("Code d'accès mis à jour.")
    setActuel('')
    setNouveau('')
    setConfirmation('')
  }

  if (!ouvert) {
    return (
      <button
        onClick={() => setOuvert(true)}
        className="flex items-center gap-1.5 text-xs font-medium text-piste-700 hover:text-piste-900"
      >
        <KeyRound size={14} /> Modifier mon code d'accès
      </button>
    )
  }

  return (
    <div className="bg-piste-50 rounded-xl p-3.5 mb-4">
      <div className="flex items-center justify-between mb-2.5">
        <p className="text-xs font-semibold text-piste-700 uppercase tracking-wide">Modifier mon code d'accès</p>
        <button onClick={() => { setOuvert(false); reinitialiserChamps() }} className="p-1 rounded-full hover:bg-white text-piste-500">
          <X size={14} />
        </button>
      </div>
      <form onSubmit={valider} className="flex flex-col sm:flex-row gap-2">
        <input
          type="password"
          inputMode="numeric"
          value={actuel}
          onChange={(e) => setActuel(e.target.value.replace(/\D/g, ''))}
          placeholder="Code actuel"
          maxLength={6}
          className="flex-1 rounded-lg border border-piste-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-piste-500"
        />
        <input
          type="password"
          inputMode="numeric"
          value={nouveau}
          onChange={(e) => setNouveau(e.target.value.replace(/\D/g, ''))}
          placeholder="Nouveau code"
          maxLength={6}
          className="flex-1 rounded-lg border border-piste-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-piste-500"
        />
        <input
          type="password"
          inputMode="numeric"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value.replace(/\D/g, ''))}
          placeholder="Confirme le nouveau code"
          maxLength={6}
          className="flex-1 rounded-lg border border-piste-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-piste-500"
        />
        <button type="submit" className="flex items-center justify-center gap-1.5 bg-piste-800 hover:bg-piste-700 text-white text-sm font-medium px-3.5 py-2 rounded-lg transition">
          <Check size={14} /> Valider
        </button>
      </form>
      {message && <p className={`text-xs mt-2 ${erreur ? 'text-alerte' : 'text-piste-600'}`}>{message}</p>}
    </div>
  )
}
