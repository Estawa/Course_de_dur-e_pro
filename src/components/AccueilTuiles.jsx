import { FilePlus, Library, Wrench, LogOut } from 'lucide-react'

const TUILES = [
  { id: 'vierge', icone: FilePlus, titre: 'Séance vierge', description: 'Compose et réalise ta propre séance' },
  { id: 'bibliotheque', icone: Library, titre: 'Bibliothèque', description: 'Séances proposées par ton professeur et ton historique' },
  { id: 'outils', icone: Wrench, titre: 'Outils', description: 'Tests VMA, chrono, Borg, performances estimées' }
]

export default function AccueilTuiles({ eleve, onChoisirTuile, onDeconnexion }) {
  return (
    <div className="max-w-md mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-piste-600 text-sm">Bonjour</p>
          <h2 className="font-display text-2xl text-piste-900">{eleve.prenom} {eleve.nom}</h2>
          <p className="text-xs text-piste-500 mt-0.5">Classe {eleve.classe}</p>
        </div>
        <button onClick={onDeconnexion} className="p-2 rounded-full text-piste-500 hover:bg-piste-100 transition" aria-label="Changer d'élève">
          <LogOut size={18} />
        </button>
      </div>

      <div className="space-y-4">
        {TUILES.map(({ id, icone: Icone, titre, description }) => (
          <button
            key={id}
            onClick={() => onChoisirTuile(id)}
            className="w-full text-left bg-white border-2 border-piste-100 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-piste-300 transition flex items-center gap-4"
          >
            <div className="w-12 h-12 rounded-xl bg-piste-800 flex items-center justify-center shrink-0">
              <Icone className="text-piste-100" size={22} />
            </div>
            <div>
              <p className="font-display text-lg text-piste-900">{titre}</p>
              <p className="text-xs text-piste-500 mt-0.5">{description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
