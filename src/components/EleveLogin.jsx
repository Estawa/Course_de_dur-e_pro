import { useState } from 'react'
import { Footprints } from 'lucide-react'
import { storage } from '../utils/storage'

export default function EleveLogin({ onConnecte }) {
  const [nom, setNom] = useState('')
  const [prenom, setPrenom] = useState('')
  const [classe, setClasse] = useState('')
  const [erreur, setErreur] = useState('')

  function valider(e) {
    e.preventDefault()
    if (!nom.trim() || !prenom.trim() || !classe.trim()) {
      setErreur('Renseigne ton nom, ton prénom et ta classe pour continuer.')
      return
    }
    const eleve = { nom: nom.trim(), prenom: prenom.trim(), classe: classe.trim().toUpperCase() }
    storage.ajouterEleveAuRoster(eleve)
    storage.setEleve(eleve)
    onConnecte(eleve)
  }

  return (
    <div className="max-w-md mx-auto px-6 py-14">
      <div className="flex flex-col items-center text-center mb-8">
        <div className="w-16 h-16 rounded-2xl bg-piste-800 flex items-center justify-center mb-4">
          <Footprints className="text-piste-200" size={30} />
        </div>
        <h2 className="font-display text-2xl text-piste-900">Bienvenue</h2>
        <p className="text-piste-600 text-sm mt-1">Identifie-toi pour accéder à tes séances de course de durée.</p>
      </div>

      <form onSubmit={valider} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-piste-800 mb-1">Prénom</label>
          <input
            value={prenom}
            onChange={(e) => setPrenom(e.target.value)}
            className="w-full rounded-xl border border-piste-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-piste-500"
            placeholder="Ex : Léo"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-piste-800 mb-1">Nom</label>
          <input
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            className="w-full rounded-xl border border-piste-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-piste-500"
            placeholder="Ex : Martin"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-piste-800 mb-1">Classe</label>
          <input
            value={classe}
            onChange={(e) => setClasse(e.target.value)}
            className="w-full rounded-xl border border-piste-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-piste-500"
            placeholder="Ex : 2NDE4"
          />
        </div>
        {erreur && <p className="text-alerte text-sm">{erreur}</p>}
        <button
          type="submit"
          className="w-full bg-piste-800 hover:bg-piste-700 text-white font-medium py-3.5 rounded-xl transition active:scale-[0.98]"
        >
          Continuer
        </button>
      </form>
    </div>
  )
}
