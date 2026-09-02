import { useState } from 'react'
import { Lock } from 'lucide-react'
import { PIN_ENSEIGNANT } from '../utils/storage'

export default function EnseignantPin({ onValide }) {
  const [pin, setPin] = useState('')
  const [erreur, setErreur] = useState(false)

  function valider(e) {
    e.preventDefault()
    if (pin === PIN_ENSEIGNANT) {
      onValide()
    } else {
      setErreur(true)
      setPin('')
    }
  }

  return (
    <div className="max-w-xs mx-auto px-6 py-24 text-center">
      <div className="w-14 h-14 rounded-2xl bg-piste-800 flex items-center justify-center mx-auto mb-5">
        <Lock className="text-piste-200" size={24} />
      </div>
      <h2 className="font-display text-xl text-piste-900 mb-1">Espace enseignant</h2>
      <p className="text-sm text-piste-600 mb-6">Saisis le code d'accès.</p>
      <form onSubmit={valider}>
        <input
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          className={`w-full text-center text-2xl tracking-[0.5em] rounded-xl border-2 px-4 py-3 mb-3 focus:outline-none ${erreur ? 'border-alerte' : 'border-piste-200 focus:border-piste-500'}`}
          maxLength={6}
          autoFocus
        />
        {erreur && <p className="text-alerte text-xs mb-3">Code incorrect.</p>}
        <button
          type="submit"
          className="w-full bg-piste-800 hover:bg-piste-700 text-white font-medium py-3 rounded-xl transition active:scale-[0.98]"
        >
          Valider
        </button>
      </form>
    </div>
  )
}
