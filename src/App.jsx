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
import RunDirect from './components/RunDirect'
import RunDirectBilan from './components/RunDirectBilan'
import { storage } from './utils/storage'
import { calculerNoteReelle } from './utils/calc'

export default function App() {
  // --- Accès (admin + collègues) : chargé une fois au démarrage, indépendant de tout élève
  // ou espace enseignant particulier. Sert à peupler les listes "Ton professeur" / "Ton nom".
  const [accesConfig, setAccesConfig] = useState(null)
  const [chargementAcces, setChargementAcces] = useState(true)

  const [eleve, setEleve] = useState(null)
  const [chargementEleve, setChargementEleve] = useState(true)
  const [seances, setSeancesState] = useState([])
  const [realisations, setRealisations] = useState([])

  const [ecran, setEcran] = useState('accueil')
  const [seanceActive, setSeanceActive] = useState(null)
  const [niveauActif, setNiveauActif] = useState(null)
  const [dernierResultat, setDernierResultat] = useState(null)
  const [dernierRunDirect, setDernierRunDirect] = useState(null)

  // Session enseignant : locale à l'appareil (rôle + identité), les données elles-mêmes sont
  // rechargées à chaque fois via storage.chargerEspace(teacherId).
  const [role, setRole] = useState(() => storage.getRoleEnseignant())
  const [nomCollegue, setNomCollegue] = useState(() => storage.getNomCollegue())
  const [teacherIdEnseignant, setTeacherIdEnseignant] = useState(() => storage.getTeacherIdEnseignant())
  const [chargementEnseignant, setChargementEnseignant] = useState(false)

  // Vrai tant qu'un test VMA ou le Fartlek évaluatif a un chrono actif (effort/palier/course en
  // cours), pour désactiver la flèche retour de l'en-tête et éviter d'en sortir par un appui
  // accidentel — même logique que l'absence de flèche retour pendant la séance de travail.
  const [activiteEnCours, setActiviteEnCours] = useState(false)

  // Reprise de séance après fermeture/mise en veille prolongée de l'appli pendant son déroulement.
  const [sessionAReprendre, setSessionAReprendre] = useState(null) // snapshot proposé, en attente de choix
  const [repriseActive, setRepriseActive] = useState(null) // snapshot accepté, transmis à SeanceRunner

  // --- Chargement de la config d'accès (admin + collègues) ---
  useEffect(() => {
    storage.chargerAcces('8484').then((ac) => {
      setAccesConfig(ac)
      setChargementAcces(false)
    })
  }, [])

  // --- Restauration de la session élève de cet appareil (pointeur { teacherId, id } local) :
  // recharge l'espace de son professeur pour retrouver sa fiche à jour (nom/prénom/PIN). Si son
  // professeur a été retiré ou sa fiche supprimée entre-temps, la session est effacée. ---
  useEffect(() => {
    const pointeur = storage.getEleveActifPointeur()
    if (!pointeur) {
      setChargementEleve(false)
      return
    }
    storage.chargerEspace(pointeur.teacherId)
      .then(() => {
        const trouve = storage.trouverEleveParId(pointeur.id)
        if (trouve) {
          setEleve({ id: trouve.id, nom: trouve.nom, prenom: trouve.prenom, classe: trouve.classe, teacherId: pointeur.teacherId })
          setSeancesState(storage.getSeances())
          setRealisations(storage.getRealisations())
          setEcran('tuiles')
          const session = storage.getSessionCours({ id: trouve.id, nom: trouve.nom, prenom: trouve.prenom, classe: trouve.classe }, 'course')
          if (session) setSessionAReprendre(session)
        } else {
          storage.clearEleveActif()
          setEcran('accueil')
        }
      })
      .catch(() => {
        storage.clearEleveActif()
        setEcran('accueil')
      })
      .finally(() => setChargementEleve(false))
  }, [])

  function handleReprendreSession() {
    setSeanceActive(sessionAReprendre.seanceActive)
    setNiveauActif(sessionAReprendre.niveauActif)
    setRepriseActive(sessionAReprendre)
    setEcran('course')
    setSessionAReprendre(null)
  }

  function handleIgnorerSession() {
    storage.effacerSessionCours(eleve, 'course')
    setSessionAReprendre(null)
  }

  function handleProgressSeance(snapshot) {
    storage.sauvegarderSessionCours(eleve, 'course', { seanceActive, niveauActif, ...snapshot })
  }

  function setSeances(nouvelles) {
    setSeancesState(nouvelles)
    storage.setSeances(nouvelles)
  }

  function handleConnecte(e) {
    // L'espace de son professeur est déjà chargé (fait par EleveLogin avant d'appeler
    // onConnecte) : ces données sont donc déjà dans le cache actif de storage.js.
    setEleve(e)
    setSeancesState(storage.getSeances())
    setRealisations(storage.getRealisations())
    setEcran('tuiles')
  }

  function handleDeconnexion() {
    storage.clearEleveActif()
    setEleve(null)
    setEcran('accueil')
  }

  // Recharge l'espace (roster + séances + réalisations + VMA + tests) d'un teacherId donné et
  // met à jour les états dérivés qu'App.jsx expose au tableau de bord enseignant.
  async function chargerEspaceDashboard(teacherId) {
    await storage.chargerEspace(teacherId)
    setSeancesState(storage.getSeances())
    setRealisations(storage.getRealisations())
  }

  function ouvrirEspaceEnseignant(teacherId) {
    setChargementEnseignant(true)
    chargerEspaceDashboard(teacherId).then(() => {
      setChargementEnseignant(false)
      setEcran('enseignant')
    })
  }

  function handleAccesEnseignant() {
    const dejaConnecte = storage.getPinOk() && storage.getRoleEnseignant() && storage.getTeacherIdEnseignant()
    if (dejaConnecte) {
      ouvrirEspaceEnseignant(storage.getTeacherIdEnseignant())
    } else {
      setEcran('enseignantPin')
    }
  }

  function handlePinValide({ role: roleValide, nomCollegue: nom, teacherId }) {
    storage.setPinOk(true)
    storage.setRoleEnseignant(roleValide)
    storage.setNomCollegue(roleValide === 'collegue' ? nom : null)
    storage.setTeacherIdEnseignant(teacherId)
    setRole(roleValide)
    setNomCollegue(roleValide === 'collegue' ? nom : null)
    setTeacherIdEnseignant(teacherId)
    ouvrirEspaceEnseignant(teacherId)
  }

  function handleDeconnexionEnseignant() {
    storage.clearSessionEnseignant()
    setRole(null)
    setNomCollegue(null)
    setTeacherIdEnseignant(null)
    if (eleve) {
      setChargementEnseignant(true)
      chargerEspaceDashboard(eleve.teacherId).then(() => {
        setChargementEnseignant(false)
        setEcran('tuiles')
      })
    } else {
      setEcran('accueil')
    }
  }

  // --- Accès (admin + collègues) : édition depuis l'onglet "Accès" du tableau de bord ---
  function persisterAcces(next) {
    setAccesConfig(next)
    storage.sauvegarderAcces(next)
  }
  function changerPinAdmin(nouveauPin) {
    persisterAcces({ ...accesConfig, pinAdmin: nouveauPin })
  }
  function changerNomAdmin(nom) {
    persisterAcces({ ...accesConfig, nomAdmin: nom })
  }
  function ajouterCollegue(nom, pin) {
    const id = crypto.randomUUID ? crypto.randomUUID() : `c_${Date.now()}_${Math.random().toString(36).slice(2)}`
    persisterAcces({ ...accesConfig, collegues: [...(accesConfig.collegues || []), { id, nom, pin }] })
  }
  function supprimerCollegue(id) {
    persisterAcces({ ...accesConfig, collegues: (accesConfig.collegues || []).filter((c) => c.id !== id) })
  }
  function reinitialiserPinCollegue(id, nouveauPin) {
    persisterAcces({ ...accesConfig, collegues: (accesConfig.collegues || []).map((c) => (c.id === id ? { ...c, pin: nouveauPin } : c)) })
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

  function handleLancerRunDirect() {
    setEcran('runDirect')
  }

  // Le Run en direct n'est pas comparé à un objectif prescrit (pas de bloc/niveau de
  // bibliothèque) : la réalisation enregistrée porte un indicateur `runDirect` dédié plutôt que
  // blocsResultats/note, avec blocsResultats = [] pour rester compatible avec le code existant
  // (historique élève, fiche de suivi) qui suppose ce tableau toujours présent.
  function handleTermineRunDirect(resultat) {
    const titre = resultat.mode === 'complete' ? 'Run direct séance complète' : 'Run direct course immédiate'
    const realisation = {
      id: crypto.randomUUID(),
      eleve,
      seanceId: 'run-direct',
      seanceTitre: titre,
      niveauNom: '',
      date: Date.now(),
      blocsResultats: [],
      runDirect: resultat
    }
    storage.ajouterRealisation(realisation)
    setRealisations((prev) => [...prev, realisation])
    setDernierRunDirect(resultat)
    setEcran('runDirectBilan')
  }

  function handleAbandonRunDirect() {
    setEcran('outils')
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
      noteReelle,
      noteReelleAvecGps,
      ...resultat
    }
    storage.ajouterRealisation(realisation)
    setRealisations([...realisations, realisation])
    setDernierResultat(realisation)
    storage.effacerSessionCours(eleve, 'course')
    setRepriseActive(null)
    setEcran('bilan')
  }

  function handleAbandonSeance() {
    storage.effacerSessionCours(eleve, 'course')
    setRepriseActive(null)
    setEcran('tuiles')
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
    fartlek: 'Fartlek évaluatif',
    runDirect: 'Run en direct',
    runDirectBilan: 'Bilan du run'
  }

  // 'course' est volontairement exclu : pendant le déroulement du chrono, la sortie ne doit être
  // possible que via le bouton "Abandonner sans enregistrer" (avec sa confirmation), jamais par un
  // simple appui sur la flèche retour de l'en-tête. Même logique via `activiteEnCours` pour les
  // tests VMA et le Fartlek évaluatif, imbriqués plus profondément dans l'arborescence.
  const peutRevenir =
    !activiteEnCours &&
    ['bibliotheque', 'vierge', 'outils', 'choixNiveau', 'apercu', 'bilan', 'enseignant', 'enseignantPin', 'partage', 'fartlek', 'runDirect', 'runDirectBilan'].includes(ecran)

  function handleRetour() {
    if (['bibliotheque', 'vierge', 'outils'].includes(ecran)) setEcran('tuiles')
    else if (ecran === 'choixNiveau') setEcran('bibliotheque')
    else if (ecran === 'apercu') setEcran('choixNiveau')
    else if (ecran === 'bilan') setEcran('tuiles')
    else if (ecran === 'fartlek') setEcran('tuiles')
    else if (ecran === 'runDirect') setEcran('outils')
    else if (ecran === 'runDirectBilan') setEcran('tuiles')
    else if (ecran === 'enseignantPin' || ecran === 'enseignant') setEcran(eleve ? 'tuiles' : 'accueil')
    else if (ecran === 'partage') setEcran(eleve ? 'tuiles' : 'accueil')
  }

  const pret = !chargementAcces && !chargementEleve

  return (
    <div className="min-h-screen bg-white font-body">
      <Header
        title={titres[ecran]}
        onBack={peutRevenir ? handleRetour : null}
        onEnseignant={handleAccesEnseignant}
        showEnseignant={ecran !== 'course' && !(ecran === 'runDirect' && activiteEnCours)}
        onPartager={() => setEcran('partage')}
        showPartage={ecran === 'accueil'}
      />

      {!eleve && ecran === 'accueil' && (
        pret
          ? <EleveLogin accesConfig={accesConfig} onConnecte={handleConnecte} />
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

      {ecran === 'outils' && <OutilsEleve eleve={eleve} onComposerSeance={() => setEcran('vierge')} onLancerFartlek={() => setEcran('fartlek')} onLancerRunDirect={handleLancerRunDirect} onActiviteEnCours={setActiviteEnCours} />}

      {ecran === 'runDirect' && (
        <RunDirect eleve={eleve} vmaRef={vmaRef} onTermine={handleTermineRunDirect} onAbandon={handleAbandonRunDirect} onActiviteEnCours={setActiviteEnCours} />
      )}

      {ecran === 'runDirectBilan' && dernierRunDirect && (
        <RunDirectBilan resultat={dernierRunDirect} onRetourAccueil={() => setEcran('tuiles')} />
      )}

      {ecran === 'fartlek' && (
        <FartlekEval eleve={eleve} vmaRef={vmaRef} onTermine={() => setEcran('tuiles')} onActiviteEnCours={setActiviteEnCours} />
      )}

      {ecran === 'choixNiveau' && seanceActive && (
        <ChoixNiveau seance={seanceActive} vmaRef={vmaRef} onChoisirNiveau={handleChoisirNiveau} />
      )}

      {ecran === 'apercu' && niveauActif && (
        <ApercuSeance niveau={niveauActif} seanceTitre={seanceActive?.titre} vmaRef={vmaRef} regleParticuliere={seanceActive?.regleParticuliere} onDemarrer={handleDemarrerSeance} />
      )}

      {ecran === 'course' && niveauActif && (
        <SeanceRunner
          niveau={niveauActif}
          vmaRef={vmaRef}
          reprise={repriseActive}
          onProgress={handleProgressSeance}
          onFinSeance={handleFinSeance}
          onAbandon={handleAbandonSeance}
        />
      )}

      {ecran === 'bilan' && dernierResultat && (
        <Bilan resultat={dernierResultat} niveau={niveauActif} onRetourAccueil={() => setEcran('tuiles')} />
      )}

      {ecran === 'enseignantPin' && <EnseignantPin accesConfig={accesConfig} onValide={handlePinValide} />}

      {ecran === 'enseignant' && (
        chargementEnseignant ? (
          <div className="max-w-md mx-auto px-6 py-24 text-center text-piste-500 text-sm">Chargement…</div>
        ) : (
          <EnseignantDashboard
            role={role}
            nomCollegue={nomCollegue}
            teacherIdEnseignant={teacherIdEnseignant}
            accesConfig={accesConfig}
            onChangerEspace={chargerEspaceDashboard}
            onChangerPinAdmin={changerPinAdmin}
            onChangerNomAdmin={changerNomAdmin}
            onAjouterCollegue={ajouterCollegue}
            onSupprimerCollegue={supprimerCollegue}
            onReinitialiserPinCollegue={reinitialiserPinCollegue}
            seances={seances}
            setSeances={setSeances}
            realisations={realisations}
            onModifierRealisation={handleModifierRealisation}
            onSupprimerRealisation={handleSupprimerRealisation}
            onSupprimerRealisationsEleve={handleSupprimerRealisationsEleve}
            onSupprimerRealisationsClasse={handleSupprimerRealisationsClasse}
          />
        )
      )}

      {sessionAReprendre && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center shadow-lg">
            <p className="font-display text-lg text-piste-900 mb-2">Séance interrompue</p>
            <p className="text-sm text-piste-600 mb-6">
              Une séance ({sessionAReprendre.seanceActive?.titre || 'séance libre'}) était en cours et s'est arrêtée avant la fin. Veux-tu reprendre là où tu en étais ?
            </p>
            <button
              onClick={handleReprendreSession}
              className="w-full bg-piste-800 hover:bg-piste-700 text-white font-medium py-3 rounded-xl transition active:scale-[0.98] mb-2"
            >
              Reprendre la séance
            </button>
            <button onClick={handleIgnorerSession} className="text-xs text-piste-400 underline">
              Non, ne pas reprendre
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
