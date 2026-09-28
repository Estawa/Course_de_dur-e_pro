import { useEffect } from 'react'
import { Hand } from 'lucide-react'
import { beepFin, annoncerVocal } from '../utils/audio'
import { libelleMotif } from '../utils/arretProf'

// Écran affiché à l'élève quand son professeur arrête la séance (ou le test) : motif, et ce qui
// sera pris en compte. nbParties = null pour un écran sans notion de parties (tests, Fartlek).
export default function ArretProfAnnonce({ arret, nbParties = null, nbPartiesPrevues = null, message, libelleBouton, onContinuer }) {
  useEffect(() => {
    beepFin()
    annoncerVocal('Séance arrêtée par ton professeur')
  }, [])

  const rienARetenir = nbParties === 0
  const texte =
    message ||
    (rienARetenir
      ? "Aucune partie n'a pu être courue : rien ne sera noté pour cette séance."
      : nbParties != null
        ? `Seul ce que tu as couru sera pris en compte (${nbParties} partie${nbParties > 1 ? 's' : ''} sur ${nbPartiesPrevues}). Ce qui n'a pas pu être fait ne te pénalise pas.`
        : 'Seul ce que tu as couru sera pris en compte.')

  return (
    <div className="max-w-md mx-auto px-6 py-10 text-center">
      <div className="rounded-3xl border-4 border-piste-800 bg-piste-800 text-white px-4 py-6 mb-6">
        <Hand size={44} className="mx-auto mb-3" />
        <p className="font-display font-bold uppercase text-3xl leading-tight">Séance arrêtée</p>
        <p className="text-sm text-white/80 mt-1">par ton professeur</p>
      </div>
      {arret && (
        <p className="text-sm font-medium text-piste-900 mb-3">Motif : {libelleMotif(arret)}</p>
      )}
      <p className="text-sm text-piste-600 mb-8">{texte}</p>
      <button
        onClick={onContinuer}
        className="w-full bg-piste-800 hover:bg-piste-700 text-white font-medium py-3.5 rounded-xl transition active:scale-[0.98]"
      >
        {libelleBouton || (rienARetenir ? "Retour à l'accueil" : 'Continuer')}
      </button>
    </div>
  )
}
