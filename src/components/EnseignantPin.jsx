import { useMemo, useState } from 'react'
import { Lock } from 'lucide-react'

// onValide({ role: 'admin' | 'collegue', nomCollegue?, teacherId })
// teacherId = 'admin' pour Christophe, ou l'id du collègue (= sa base classes/suivi isolée).
export default function EnseignantPin({ accesConfig, onValide }) {
  const noms = useMemo(() => {
    const liste = [{ id: 'admin', nom: accesConfig?.nomAdmin || 'Mr Guilhem' }]
    ;(accesConfig?.collegues || []).forEach((c) => liste.push({ id: c.id, nom: c.nom }))
    return liste
  }, [accesConfig])

  const [nomId, setNomId] = useState('')
  const [pin, setPin] = useState('')
  const [erreur, setErreur] = useState(false)

  function valider(e) {
    e.preventDefault()
    if (!nomId) {
      setErreur(true)
      return
    }
    if (nomId === 'admin' && pin === accesConfig.pinAdmin) {
      onValide({ role: 'admin', teacherId: 'admin' })
      return
    }
    const collegue = (accesConfig.collegues || []).find((c) => c.id === nomId)
    if (collegue && collegue.pin === pin) {
      onValide({ role: 'collegue', nomCollegue: collegue.nom, teacherId: collegue.id })
      return
    }
    setErreur(true)
    setPin('')
  }

  return (
    <div className="max-w-xs mx-auto px-6 py-20 text-center">
      <div className="w-14 h-14 rounded-2xl bg-piste-800 flex items-center justify-center mx-auto mb-5">
        <Lock className="text-piste-200" size={24} />
      </div>
      <h2 className="font-display text-xl text-piste-900 mb-1">Espace enseignant</h2>
      <p className="text-sm text-piste-600 mb-6">Ton nom et ton code d'accès personnel.</p>
      <form onSubmit={valider} className="space-y-3 text-left">
        <div>
          <label className="block text-xs font-medium text-piste-700 mb-1">Ton nom</label>
          <select
            value={nomId}
            onChange={(e) => { setNomId(e.target.value); setErreur(false) }}
            className={`w-full bg-white border-2 rounded-xl px-4 py-3 font-medium text-piste-900 focus:outline-none ${erreur && !nomId ? 'border-alerte' : 'border-piste-200 focus:border-piste-500'}`}
          >
            <option value="" disabled>Sélectionne ton nom...</option>
            {noms.map((n) => (
              <option key={n.id} value={n.id}>{n.nom}</option>
            ))}
          </select>
        </div>
        <input
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
          placeholder="Code d'accès"
          className={`w-full text-center text-2xl tracking-[0.5em] rounded-xl border-2 px-4 py-3 focus:outline-none ${erreur ? 'border-alerte' : 'border-piste-200 focus:border-piste-500'}`}
          maxLength={6}
        />
        {erreur && <p className="text-alerte text-xs">Nom ou code incorrect.</p>}
        <button
          type="submit"
          className="w-full bg-piste-800 hover:bg-piste-700 text-white font-medium py-3 rounded-xl transition active:scale-[0.98]"
        >
          Se connecter
        </button>
      </form>
    </div>
  )
}
