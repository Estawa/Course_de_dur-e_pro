import { useEffect, useState } from 'react'
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
import PartageApp from './components/PartageApp'
import FartlekEval from './components/FartlekEval'
import { storage } from './utils/storage'
import { calculerNoteReelle } from './utils/calc'

export default function App() {
  const [eleve, setEleve] = useState(() => storage.getEleveActif())
  const [seances, setSeancesState] = useState(() => storage.getSeances())
  const [realisations, setRealisations] = useState(() => storage.getRealisations())
  const [cloudTick, setCloudTick] = useState(0)
  const [pretSync, setPretSync] = useState(false)
  const [codeSyncActuel, setCodeSyncActuel] = useState(() => storage.getCodeSync())

  const [ecran, setEcran] = useState(() => (storage.getEleveActif() ? 'tuiles' : 'accueil'))
  const [seanceActive, setSeanceActive] = useState(null)
  const [niveauActif, setNiveauActif] = useState(null)
  const [dernierResultat, setDernierResultat] = useState(null)

  // Applique un éventuel code de synchro reçu par lien (?c=XXXXX, cas d'un élève qui
  // ouvre le flashcode/lien partagé par le prof) une seule fois au démarrage.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('c')
    if (code) {
      storage.appliquerCodeDepuisLien(code)
      params.delete('c')
      const reste = params.toString()
      window.history.replaceState({}, '', window.location.pathname + (reste ? `?${reste}` : ''))
      setCodeSyncActuel(storage.getCodeSync())
    }
  }, [])

  // (Re)démarre l'écoute cloud temps réel dès qu'un code de synchro est disponible —
  // au démarrage s'il existait déjà, ou dès qu'il vient d'être généré/reçu.
  useEffect(() => {
    if (!codeSyncActuel) {
      setPretSync(true)
      return
    }

    let recuEleves = false
    const arreter = storage.demarrerSynchroCloud((type) => {
      setSeancesState(storage.getSeances())
      setRealisations(storage.getRealisations())
      setCloudTick((t) => t + 1)
      if (type === 'eleves') {
        recuEleves = true
        setPretSync(true)
      }
    })
    // Filet de sécurité si le cloud est injoignable ou trop lent (connexion faible, tout
    // premier chargement sans cache local) : on ne bloque pas l'appli indéfiniment.
    const delai = setTimeout(() => { if (!recuEleves) setPretSync(true) }, 6000)
    return () => { arreter(); clearTimeout(delai) }
  }, [codeSyncActuel])

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
    if (storage.cloudDisponible() && !storage.getCodeSync()) {
      storage.assurerCodeSync()
      setCodeSyncActuel(storage.getCodeSync())
    }
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

  function handleSupprimerRealisation(id) {
    const nouvelles = storage.supprimerRealisation(id)
    setRealisations(nouvelles)
  }

  function handleSupprimerRealisationsEleve(eleveId, nom, prenom, classe) {
    const nouvelles = storage.supprimerRealisationsEleve(eleveId, nom, prenom, classe)
    setRealisations(nouvelles)
  }

  function handleSupprimerRealisationsClasse(classe) {
    const nouvelles = storage.supprimerRealisationsClasse(classe)
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
    enseignant: 'Espace enseignant',
    partage: 'Partager l\'application',
    fartlek: 'Fartlek évaluatif'
  }

  const peutRevenir = ['bibliotheque', 'vierge', 'outils', 'choixNiveau', 'apercu', 'course', 'bilan', 'enseignant', 'enseignantPin', 'partage', 'fartlek'].includes(ecran)

  function handleRetour() {
    if (['bibliotheque', 'vierge', 'outils'].includes(ecran)) setEcran('tuiles')
    else if (ecran === 'choixNiveau') setEcran('bibliotheque')
    else if (ecran === 'apercu') setEcran('choixNiveau')
    else if (ecran === 'course') setEcran('tuiles')
    else if (ecran === 'bilan') setEcran('tuiles')
    else if (ecran === 'fartlek') setEcran('tuiles')
    else if (ecran === 'enseignantPin' || ecran === 'enseignant') setEcran(eleve ? 'tuiles' : 'accueil')
    else if (ecran === 'partage') setEcran(eleve ? 'tuiles' : 'accueil')
  }

  return (
    <div className="min-h-screen bg-white font-body">
      <Header
        title={titres[ecran]}
        onBack={peutRevenir ? handleRetour : null}
        onEnseignant={handleAccesEnseignant}
        showEnseignant={ecran !== 'course'}
        onPartager={() => setEcran('partage')}
        showPartage={ecran === 'accueil'}
      />

      {!eleve && ecran === 'accueil' && (
        pretSync
          ? <EleveLogin onConnecte={handleConnecte} />
          : (
            <div className="max-w-md mx-auto px-6 py-24 text-center text-piste-500 text-sm">
              Chargement…
            </div>
          )
      )}

      {ecran === 'partage' && <PartageApp />}

      {eleve && ecran === 'tuiles' && (
        <AccueilTuiles eleve={eleve} onChoisirTuile={handleChoisirTuile} onDeconnexion={handleDeconnexion} />
      )}

      {ecran === 'bibliotheque' && (
        <BibliothequeEleve seances={seances} realisations={mesRealisations} eleve={eleve} onChoisirSeance={handleChoisirSeanceBibliotheque} onLancerFartlek={() => setEcran('fartlek')} />
      )}

      {ecran === 'vierge' && <SeanceVierge onLancer={handleLancerSeanceVierge} />}

      {ecran === 'outils' && <OutilsEleve eleve={eleve} onComposerSeance={() => setEcran('vierge')} onLancerFartlek={() => setEcran('fartlek')} />}

      {ecran === 'fartlek' && (
        <FartlekEval eleve={eleve} vmaRef={vmaRef} onTermine={() => setEcran('tuiles')} />
      )}

      {ecran === 'choixNiveau' && seanceActive && (
        <ChoixNiveau seance={seanceActive} vmaRef={vmaRef} onChoisirNiveau={handleChoisirNiveau} />
      )}

      {ecran === 'apercu' && niveauActif && (
        <ApercuSeance niveau={niveauActif} seanceTitre={seanceActive?.titre} vmaRef={vmaRef} regleParticuliere={seanceActive?.regleParticuliere} onDemarrer={handleDemarrerSeance} />
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
          onSupprimerRealisation={handleSupprimerRealisation}
          onSupprimerRealisationsEleve={handleSupprimerRealisationsEleve}
          onSupprimerRealisationsClasse={handleSupprimerRealisationsClasse}
          cloudTick={cloudTick}
        />
      )}
    </div>
  )
}
