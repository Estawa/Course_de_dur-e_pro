import { useState } from 'react'
import Header from './components/Header'
import EleveLogin from './components/EleveLogin'
import AccueilTuiles from './components/AccueilTuiles'
import BibliothequeEleve from './components/BibliothequeEleve'
import SeanceVierge from './components/SeanceVierge'
import OutilsEleve from './components/OutilsEleve'
import ChoixNiveau from './components/ChoixNiveau'
import ApercuSeance from './components/ApercuSeance'
import SeanceRunner from './components/SeanceRunner'
import Bilan from './components/Bilan'
import EnseignantPin from './components/EnseignantPin'
import EnseignantDashboard from './components/EnseignantDashboard'
import { storage } from './utils/storage'
import { calculerNoteReelle } from './utils/calc'

export default function App() {
  const [eleve, setEleve] = useState(() => storage.getEleveActif())
  const [seances, setSeancesState] = useState(() => storage.getSeances())
  const [realisations, setRealisations] = useState(() => storage.getRealisations())

  const [ecran, setEcran] = useState(() => (storage.getEleveActif() ? 'tuiles' : 'accueil'))
  const [seanceActive, setSeanceActive] = useState(null)
  const [niveauActif, setNiveauActif] = useState(null)
  const [dernierResultat, setDernierResultat] = useState(null)

  function setSeances(nouvelles) {
    setSeancesState(nouvelles)
    storage.setSeances(nouvelles)
  }

  function handleConnecte(e) {
    setEleve(e)
    setEcran('tuiles')
  }

  function handleDeconnexion() {
    storage.clearEleveActif()
    setEleve(null)
    setEcran('accueil')
  }

  function handleChoisirTuile(id) {
    if (id === 'vierge') setEcran('vierge')
    else if (id === 'bibliotheque') setEcran('bibliotheque')
    else if (id === 'outils') setEcran('outils')
  }

  function handleChoisirSeanceBibliotheque(seance) {
    setSeanceActive(seance)
    setEcran('choixNiveau')
  }

  function handleChoisirNiveau(niveau) {
    setNiveauActif(niveau)
    setEcran('apercu')
  }

  function handleDemarrerSeance() {
    setEcran('course')
  }

  function handleLancerSeanceVierge({ titre, niveau }) {
    setSeanceActive({ id: 'libre', titre })
    setNiveauActif(niveau)
    setEcran('course')
  }

  function handleFinSeance(resultat) {
    const { note: noteReelle, avecGps: noteReelleAvecGps } = calculerNoteReelle(resultat.blocsResultats)
    const realisation = {
      id: crypto.randomUUID(),
      eleve,
      seanceId: seanceActive.id,
      seanceTitre: seanceActive.titre,
      niveauNom: niveauActif.nom,
      date: Date.now(),
      guidage: niveauActif.guidage,
      noteReelle,
      noteReelleAvecGps,
      ...resultat
    }
    storage.ajouterRealisation(realisation)
    setRealisations([...realisations, realisation])
    setDernierResultat(realisation)
    setEcran('bilan')
  }

  function handleAccesEnseignant() {
    setEcran(storage.getPinOk() ? 'enseignant' : 'enseignantPin')
  }

  function handlePinValide() {
    storage.setPinOk(true)
    setEcran('enseignant')
  }

  const mesRealisations = eleve
    ? realisations.filter((r) =>
        r.eleve.id
          ? r.eleve.id === eleve.id
          : r.eleve.nom === eleve.nom && r.eleve.prenom === eleve.prenom && r.eleve.classe === eleve.classe
      )
    : []
  const vmaRef = eleve ? storage.getVmaRetenue(eleve) : null

  function handleModifierRealisation(id, patch) {
    const nouvelles = storage.modifierRealisation(id, patch)
    setRealisations(nouvelles)
  }

  const titres = {
    accueil: eleve ? 'Mes séances' : 'Identification',
    tuiles: 'Accueil',
    bibliotheque: 'Bibliothèque',
    vierge: 'Séance vierge',
    outils: 'Outils',
    choixNiveau: 'Choix du niveau',
    apercu: 'Aperçu de la séance',
    course: 'Course en cours',
    bilan: 'Bilan de séance',
    enseignantPin: 'Espace enseignant',
    enseignant: 'Espace enseignant'
  }

  const peutRevenir = ['bibliotheque', 'vierge', 'outils', 'choixNiveau', 'apercu', 'course', 'bilan', 'enseignant', 'enseignantPin'].includes(ecran)

  function handleRetour() {
    if (['bibliotheque', 'vierge', 'outils'].includes(ecran)) setEcran('tuiles')
    else if (ecran === 'choixNiveau') setEcran('bibliotheque')
    else if (ecran === 'apercu') setEcran('choixNiveau')
    else if (ecran === 'course') setEcran('tuiles')
    else if (ecran === 'bilan') setEcran('tuiles')
    else if (ecran === 'enseignantPin' || ecran === 'enseignant') setEcran(eleve ? 'tuiles' : 'accueil')
  }

  return (
    <div className="min-h-screen bg-white font-body">
      <Header
        title={titres[ecran]}
        onBack={peutRevenir ? handleRetour : null}
        onEnseignant={handleAccesEnseignant}
        showEnseignant={ecran !== 'course'}
      />

      {!eleve && ecran === 'accueil' && <EleveLogin onConnecte={handleConnecte} />}

      {eleve && ecran === 'tuiles' && (
        <AccueilTuiles eleve={eleve} onChoisirTuile={handleChoisirTuile} onDeconnexion={handleDeconnexion} />
      )}

      {ecran === 'bibliotheque' && (
        <BibliothequeEleve seances={seances} realisations={mesRealisations} onChoisirSeance={handleChoisirSeanceBibliotheque} />
      )}

      {ecran === 'vierge' && <SeanceVierge onLancer={handleLancerSeanceVierge} />}

      {ecran === 'outils' && <OutilsEleve eleve={eleve} onComposerSeance={() => setEcran('vierge')} />}

      {ecran === 'choixNiveau' && seanceActive && (
        <ChoixNiveau seance={seanceActive} vmaRef={vmaRef} onChoisirNiveau={handleChoisirNiveau} />
      )}

      {ecran === 'apercu' && niveauActif && (
        <ApercuSeance niveau={niveauActif} seanceTitre={seanceActive?.titre} vmaRef={vmaRef} onDemarrer={handleDemarrerSeance} />
      )}

      {ecran === 'course' && niveauActif && (
        <SeanceRunner niveau={niveauActif} vmaRef={vmaRef} onFinSeance={handleFinSeance} onAbandon={() => setEcran('tuiles')} />
      )}

      {ecran === 'bilan' && dernierResultat && (
        <Bilan resultat={dernierResultat} niveau={niveauActif} onRetourAccueil={() => setEcran('tuiles')} />
      )}

      {ecran === 'enseignantPin' && <EnseignantPin onValide={handlePinValide} />}

      {ecran === 'enseignant' && (
        <EnseignantDashboard
          seances={seances}
          setSeances={setSeances}
          realisations={realisations}
          onModifierRealisation={handleModifierRealisation}
        />
      )}
    </div>
  )
}
