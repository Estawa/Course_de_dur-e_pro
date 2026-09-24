import { useEffect, useRef, useState } from 'react'
import CourseRun from './CourseRun'
import BilanBloc from './BilanBloc'
import BorgScale from './BorgScale'
import ObservationFinale from './ObservationFinale'
import Echauffement from './Echauffement'
import Recuperation from './Recuperation'
import FinSeanceAnnonce from './FinSeanceAnnonce'
import SaisieDistance from './SaisieDistance'
import PriseDePouls from './PriseDePouls'
import ChoixEchauffement from './ChoixEchauffement'
import SaisieFinTravail from './SaisieFinTravail'
import BinomeBloc from './BinomeBloc'
import { reevaluerBloc } from '../utils/binome'
import { decouperSegments, distancePhases, dureePhases, fusionnerSegments } from '../utils/guidage'
import { calculerNoteSeance } from '../utils/calc'
import { expanserStructure, dureeTotaleStructure, distanceTotaleStructure, dureeRecuperationFinale, estDernierBlocAvecRecupDelegue } from '../utils/fullpower'
import { RECUPERATION_FIXE } from '../utils/phasesFixes'
import { useWakeLock } from '../utils/wakeLock'
import { libelleNiveau } from '../utils/niveauLabels'

export function preparerBloc(bloc, niveau, vmaRef) {
  if (bloc.mode === 'fullpower' && bloc.structure) {
    // Le dernier bloc du niveau, s'il a sa propre "Récupération / retour au calme final" active,
    // ne la joue pas lui-même : elle sert uniquement à régler la durée de l'écran séance-level
    // dédié (Recuperation, voir plus bas) — sinon elle serait jouée deux fois de suite.
    const opts = estDernierBlocAvecRecupDelegue(niveau, bloc.id) ? { inclureRecupFinale: false } : undefined
    return {
      phases: expanserStructure(bloc.structure, vmaRef, opts),
      distanceCible: distanceTotaleStructure(bloc.structure, vmaRef, opts),
      dureeCible: dureeTotaleStructure(bloc.structure, opts)
    }
  }
  return {
    phases: [{ phase: 'travail', duree_s: bloc.duree_s, vitesse_kmh: bloc.allure_kmh }],
    distanceCible: bloc.distance_m,
    dureeCible: bloc.duree_s
  }
}

// Objectifs du bloc tels qu'ils sont réellement courus : sans les récupérations de retour au
// départ (marchées/trottinées librement, hors distance et hors allure).
export function cibleCourue(bloc, niveau, vmaRef) {
  const prep = preparerBloc(bloc, niveau, vmaRef)
  const { segments } = decouperSegments(prep.phases, niveau.retourDepart || 'auto')
  const phases = segments.flatMap((sg) => sg.phases)
  return { phases, distanceCible: distancePhases(phases), dureeCible: dureePhases(phases) }
}

// Déroulement complet d'une séance : Pouls de repos → (choix Échauffement, si activé pour ce
// niveau → Échauffement → Borg) → Pouls avant travail → blocs de Travail (boucle course/bilan
// inchangée) → à la dernière répétition, saisie groupée Pouls/Distance-Temps/Observation/Borg
// (2min30, voir SaisieFinTravail) qui enchaîne directement sur la Récupération de fin de séance
// (une seule phase continue : le temps de cette saisie fait partie de la récupération, ne s'y
// ajoute pas — voir Recuperation/dejaEcouleS) → Borg récup (sauf récup sautée, avec retour arrière
// possible tant que le bilan final n'est pas validé) → Pouls final → annonce de fin → observation
// générale → fiche récapitulative.
// Mode binôme (prop `binome` = { eleve, vma, vmaPorteur, vmaGuidage }) : le guidage se fait sur
// la VMA moyenne des deux élèves ; chaque bloc est ensuite réévalué contre les objectifs
// personnels de chacun (utils/binome.js), le porteur indique après chaque bloc si son binôme est
// resté avec lui, les pouls sont saisis pour les deux à chaque prise, et le binôme renseigne son
// propre Borg et son observation en toute fin de séance.
// modeGuidage : 'gps' | 'bips' | 'mixte' (voir utils/guidage.js). L'élève peut passer en mixte
// en cours de séance (GPS imprécis ou perdu). Chaque bloc est découpé en segments séparés par les
// récupérations de retour au départ ; après chaque segment, l'élève saisit sa distance.
export default function SeanceRunner({ niveau, vmaRef, binome = null, modeGuidage = 'gps', reprise, onProgress, onFinSeance, onAbandon }) {
  useWakeLock(true)

  const echauffementActif = !!niveau.echauffement?.active
  const vmaGuidage = binome ? binome.vmaGuidage : vmaRef
  const prenomBinome = binome?.eleve?.prenom

  const [indexBloc, setIndexBloc] = useState(() => reprise?.indexBloc ?? 0)
  const [phase, setPhase] = useState(() => reprise?.phase ?? 'poulsRepos')
  const [resultatsCourseBloc, setResultatsCourseBloc] = useState(() => reprise?.resultatsCourseBloc ?? null)
  const [blocsResultats, setBlocsResultats] = useState(() => reprise?.blocsResultats ?? [])
  const [echauffementChoisi, setEchauffementChoisi] = useState(() => reprise?.echauffementChoisi ?? null)
  const [echauffementResultat, setEchauffementResultat] = useState(() => reprise?.echauffementResultat ?? null)
  const [recuperationResultat, setRecuperationResultat] = useState(() => reprise?.recuperationResultat ?? null)
  const [recuperationSautee, setRecuperationSautee] = useState(() => reprise?.recuperationSautee ?? false)
  const [borgParPhase, setBorgParPhase] = useState(() => reprise?.borgParPhase ?? { echauffement: null, travail: null, recuperation: null })
  const [poulsParPhase, setPoulsParPhase] = useState(() => reprise?.poulsParPhase ?? { repos: null, avantTravail: null, apresTravail: null, final: null })
  const [observationTravail, setObservationTravail] = useState(() => reprise?.observationTravail ?? '')
  const [dejaEcouleRecupS, setDejaEcouleRecupS] = useState(() => reprise?.dejaEcouleRecupS ?? 0)
  // --- Mode binôme ---
  const [blocsResultatsBinome, setBlocsResultatsBinome] = useState(() => reprise?.blocsResultatsBinome ?? [])
  const [poulsBinome, setPoulsBinome] = useState(() => reprise?.poulsBinome ?? { repos: null, avantTravail: null, apresTravail: null, final: null })
  const [bilanBlocEnAttente, setBilanBlocEnAttente] = useState(() => reprise?.bilanBlocEnAttente ?? null)
  const [observationGeneraleEnAttente, setObservationGeneraleEnAttente] = useState(() => reprise?.observationGeneraleEnAttente ?? null)
  const [borgBinome, setBorgBinome] = useState(() => reprise?.borgBinome ?? null)
  // --- Guidage et segments de course ---
  const [modeEffectif, setModeEffectif] = useState(() => reprise?.modeEffectif ?? modeGuidage)
  const [indexSegment, setIndexSegment] = useState(() => reprise?.indexSegment ?? 0)
  const [segmentsResultats, setSegmentsResultats] = useState(() => reprise?.segmentsResultats ?? [])
  const [resultatSegment, setResultatSegment] = useState(() => reprise?.resultatSegment ?? null)
  const [retourFinTs, setRetourFinTs] = useState(() => reprise?.retourFinTs ?? null)
  const toursEnCoursRef = useRef(reprise?.courseEtat === 'course' ? reprise.toursEnCours || 0 : 0)
  const courseStartTsRef = useRef(reprise?.courseEtat === 'course' ? reprise.courseStartTs : null)
  const [repriseConsommee, setRepriseConsommee] = useState(false)
  // Distance GPS du bloc de course en cours, remontée en continu par CourseRun (voir
  // handleDistanceProgress), pour pouvoir la restaurer si l'appli se ferme en pleine course.
  const distanceBlocEnCoursRef = useRef(
    reprise?.courseEtat === 'course' ? reprise.distanceBlocEnCours || 0 : 0
  )

  function snapshotProgress() {
    return {
      indexBloc,
      phase,
      blocsResultats,
      echauffementChoisi,
      echauffementResultat,
      recuperationResultat,
      recuperationSautee,
      borgParPhase,
      poulsParPhase,
      observationTravail,
      dejaEcouleRecupS,
      resultatsCourseBloc,
      blocsResultatsBinome,
      poulsBinome,
      bilanBlocEnAttente,
      observationGeneraleEnAttente,
      borgBinome,
      modeEffectif,
      indexSegment,
      segmentsResultats,
      resultatSegment,
      retourFinTs,
      toursEnCours: phase === 'course' ? toursEnCoursRef.current : 0,
      courseStartTs: courseStartTsRef.current,
      courseEtat: phase === 'course' ? 'course' : null,
      distanceBlocEnCours: phase === 'course' ? distanceBlocEnCoursRef.current : 0
    }
  }

  useEffect(() => {
    onProgress?.(snapshotProgress())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indexBloc, phase, blocsResultats, echauffementChoisi, echauffementResultat, recuperationResultat, recuperationSautee, borgParPhase, poulsParPhase, observationTravail, dejaEcouleRecupS, resultatsCourseBloc, blocsResultatsBinome, poulsBinome, bilanBlocEnAttente, observationGeneraleEnAttente, borgBinome, modeEffectif, indexSegment, segmentsResultats, resultatSegment, retourFinTs])

  function handleCourseDemarre(ts) {
    courseStartTsRef.current = ts
    setRepriseConsommee(true)
  }

  // Remontée régulière (toutes les ~3s, via CourseRun) de la distance du bloc en cours, pour
  // que la sauvegarde de session reste à jour même sans changement de phase entre-temps.
  function handleDistanceProgress(distance, tours) {
    distanceBlocEnCoursRef.current = distance
    toursEnCoursRef.current = tours || 0
    onProgress?.(snapshotProgress())
  }

  const repriseCourseValide =
    !repriseConsommee && phase === 'course' && reprise?.courseEtat === 'course' && reprise.indexBloc === indexBloc &&
    (reprise.indexSegment ?? 0) === indexSegment
  const resumeStartTs = repriseCourseValide ? reprise.courseStartTs : null
  const resumeDistance = repriseCourseValide ? reprise.distanceBlocEnCours || 0 : 0
  const resumeTours = repriseCourseValide ? reprise.toursEnCours || 0 : 0

  const bloc = niveau.blocs[indexBloc]
  const dernierBloc = indexBloc === niveau.blocs.length - 1
  const labelBloc = bloc ? `Bloc ${indexBloc + 1}/${niveau.blocs.length} · ${libelleNiveau(niveau.nom)}` : libelleNiveau(niveau.nom)
  const preparation = bloc ? preparerBloc(bloc, niveau, vmaGuidage) : null
  const decoupage = preparation ? decouperSegments(preparation.phases, niveau.retourDepart || 'auto') : { segments: [], retours: [] }
  const nbSegments = decoupage.segments.length
  const segment = decoupage.segments[indexSegment] || decoupage.segments[0]
  const dernierSegment = indexSegment >= nbSegments - 1
  const labelSegment = nbSegments > 1 ? ` · Partie ${indexSegment + 1}/${nbSegments}` : ''

  function poulsBinomeSur(cle, valeurBinome) {
    if (binome) setPoulsBinome((p) => ({ ...p, [cle]: valeurBinome ?? null }))
  }

  function handlePoulsRepos(valeur, valeurBinome) {
    setPoulsParPhase((p) => ({ ...p, repos: valeur }))
    poulsBinomeSur('repos', valeurBinome)
    setPhase(echauffementActif ? 'choixEchauffement' : 'poulsAvantTravail')
  }

  function handleChoixEchauffement(choix) {
    setEchauffementChoisi(choix)
    setPhase(choix ? 'echauffement' : 'poulsAvantTravail')
  }

  function handleTermineEchauffement(resultat) {
    setEchauffementResultat(resultat)
    setPhase('borgEchauffement')
  }

  function handleValideBorgEchauffement(valeur) {
    setBorgParPhase((p) => ({ ...p, echauffement: valeur }))
    setPhase('poulsAvantTravail')
  }

  function handlePoulsAvantTravail(valeur, valeurBinome) {
    setPoulsParPhase((p) => ({ ...p, avantTravail: valeur }))
    poulsBinomeSur('avantTravail', valeurBinome)
    setPhase('course')
  }

  function handleTermineBloc(resultatCourse) {
    // Fin d'un segment de course : l'élève saisit sa distance (et, s'il reste une partie à
    // courir, retourne au départ pendant la récupération).
    setResultatSegment(resultatCourse)
    if (!dernierSegment) {
      setRetourFinTs(Date.now() + (decoupage.retours[indexSegment]?.duree_s || 0) * 1000)
    } else {
      setRetourFinTs(null)
    }
    setPhase('saisieDistance')
  }

  function handleValideDistance(distanceDeclaree) {
    const complet = { ...resultatSegment, distanceDeclaree }
    const tous = [...segmentsResultats, complet]
    setSegmentsResultats(tous)
    if (dernierSegment) {
      // Fusion des segments puis réévaluation sur les objectifs réellement courus.
      const fusion = fusionnerSegments(tous, decoupage.segments)
      const cible = cibleCourue(bloc, niveau, vmaGuidage)
      setResultatsCourseBloc(reevaluerBloc(fusion, cible))
      setSegmentsResultats([])
      setResultatSegment(null)
      setIndexSegment(0)
      setPhase('bilanBloc')
    }
  }

  function handleRepartir() {
    setResultatSegment(null)
    setRetourFinTs(null)
    setIndexSegment((i) => i + 1)
    setPhase('course')
  }

  function handleValideBilanBloc({ reussite, note }) {
    if (binome) {
      setBilanBlocEnAttente({ reussite, note })
      setPhase('binomeBloc')
      return
    }
    const blocResultat = { blocId: bloc.id, ...resultatsCourseBloc, reussite, note }
    setBlocsResultats([...blocsResultats, blocResultat])
    passerAuBlocSuivant()
  }

  // Mode binôme : le même résultat mesuré est réévalué contre les objectifs personnels du porteur
  // et du binôme. Si le binôme a décroché, son bloc est non réussi (binomePresent: false).
  function handleValideBinomeBloc({ present, note: noteBinome }) {
    const { reussite, note } = bilanBlocEnAttente || {}
    const pourPorteur = reevaluerBloc(resultatsCourseBloc, cibleCourue(bloc, niveau, binome.vmaPorteur))
    const pourBinome = reevaluerBloc(resultatsCourseBloc, cibleCourue(bloc, niveau, binome.vma))
    setBlocsResultats([...blocsResultats, { blocId: bloc.id, ...pourPorteur, reussite, note }])
    setBlocsResultatsBinome([
      ...blocsResultatsBinome,
      {
        blocId: bloc.id,
        ...pourBinome,
        binomePresent: present,
        reussite: present ? reussite : 'non_reussi',
        note: present ? note : `A décroché du binôme${noteBinome ? ` : ${noteBinome}` : ''}`
      }
    ])
    setBilanBlocEnAttente(null)
    passerAuBlocSuivant()
  }

  function passerAuBlocSuivant() {
    if (dernierBloc) {
      setPhase('finTravail')
    } else {
      setIndexBloc((i) => i + 1)
      setPhase('course')
      setResultatsCourseBloc(null)
    }
  }

  // Saisie groupée juste après la dernière répétition de travail (pouls, récap distance/temps
  // déjà mesurés, observation, Borg) — voir SaisieFinTravail. Enchaîne directement sur la
  // récupération de fin de séance, en lui transmettant le temps déjà passé sur cette saisie
  // (dureeEcouleeS) pour qu'elle en fasse partie plutôt que de s'y ajouter.
  function handleValideFinTravail({ pouls, poulsBinome: valeurBinome, observation, borg, dureeEcouleeS }) {
    setPoulsParPhase((p) => ({ ...p, apresTravail: pouls }))
    poulsBinomeSur('apresTravail', valeurBinome)
    setObservationTravail(observation)
    setBorgParPhase((p) => ({ ...p, travail: borg }))
    setDejaEcouleRecupS(dureeEcouleeS)
    setPhase('recuperation')
  }

  function handleTermineRecuperation(resultat) {
    setRecuperationResultat(resultat)
    setRecuperationSautee(false)
    setPhase('borgRecuperation')
  }

  function handlePasserRecuperation() {
    setRecuperationSautee(true)
    setPhase('poulsFinal')
  }

  function handleValideBorgRecuperation(valeur) {
    setBorgParPhase((p) => ({ ...p, recuperation: valeur }))
    setPhase('poulsFinal')
  }

  function handleReprendreRecuperation() {
    setRecuperationSautee(false)
    setRecuperationResultat(null)
    setDejaEcouleRecupS(0)
    setPhase('recuperation')
  }

  function handlePoulsFinal(valeur, valeurBinome) {
    setPoulsParPhase((p) => ({ ...p, final: valeur }))
    poulsBinomeSur('final', valeurBinome)
    setPhase('finAnnonce')
  }

  function handleFinAnnonceTerminee() {
    setPhase('observation')
  }

  function handleValideObservation(observationGenerale) {
    if (binome) {
      setObservationGeneraleEnAttente(observationGenerale)
      setPhase('binomeBorg')
      return
    }
    terminerSeance(observationGenerale, null)
  }

  function handleValideBorgBinome(valeur) {
    setBorgBinome(valeur)
    setPhase('binomeObservation')
  }

  function handleValideObservationBinome(observationBinome) {
    terminerSeance(observationGeneraleEnAttente ?? '', {
      eleve: binome.eleve,
      blocsResultats: blocsResultatsBinome,
      poulsParPhase: poulsBinome,
      borgParPhase: { echauffement: null, travail: null, recuperation: borgBinome },
      borg: borgBinome,
      observationGenerale: observationBinome,
      note: calculerNoteSeance(blocsResultatsBinome)
    })
  }

  function terminerSeance(observationGenerale, resultatBinome) {
    const note = calculerNoteSeance(blocsResultats)
    onFinSeance({
      blocsResultats,
      echauffementChoisi,
      echauffementResultat,
      recuperationResultat,
      recuperationSautee,
      borgParPhase,
      poulsParPhase,
      observationTravail,
      borg: borgParPhase.recuperation ?? borgParPhase.travail ?? borgParPhase.echauffement ?? null,
      observationGenerale,
      note,
      ...(resultatBinome ? { resultatBinome } : {})
    })
  }

  if (phase === 'poulsRepos') {
    return (
      <PriseDePouls
        titre="Pouls de repos"
        binomeNom={prenomBinome}
        sousTitre="Avant de commencer la séance."
        onValide={handlePoulsRepos}
      />
    )
  }

  if (phase === 'choixEchauffement') {
    return <ChoixEchauffement onChoix={handleChoixEchauffement} />
  }

  if (phase === 'echauffement') {
    return <Echauffement onTermine={handleTermineEchauffement} dureeS={niveau.echauffement?.duree_s} />
  }

  if (phase === 'borgEchauffement') {
    return <BorgScale titre="Ton ressenti après l'échauffement" onValide={handleValideBorgEchauffement} />
  }

  if (phase === 'poulsAvantTravail') {
    return (
      <PriseDePouls
        titre="Pouls avant le travail"
        binomeNom={prenomBinome}
        sousTitre="Juste avant de démarrer la phase de travail."
        onValide={handlePoulsAvantTravail}
      />
    )
  }

  if (phase === 'course') {
    return (
      <CourseRun
        key={`${indexBloc}-${indexSegment}`}
        phases={segment.phases}
        distanceCible={distancePhases(segment.phases)}
        dureeCible={dureePhases(segment.phases)}
        labelBloc={labelBloc + labelSegment}
        labelTerminer={nbSegments > 1 ? 'Terminer cette partie' : 'Terminer le bloc'}
        modeGuidage={modeEffectif}
        onChangerMode={setModeEffectif}
        resumeTours={resumeTours}
        onTermineBloc={handleTermineBloc}
        onAbandon={onAbandon}
        resumeStartTs={resumeStartTs}
        onDemarre={handleCourseDemarre}
        resumeDistance={resumeDistance}
        onDistanceProgress={handleDistanceProgress}
      />
    )
  }

  if (phase === 'binomeBloc') {
    return <BinomeBloc labelBloc={labelBloc} prenomBinome={prenomBinome} onValide={handleValideBinomeBloc} />
  }

  if (phase === 'binomeBorg') {
    return <BorgScale titre={`Ressenti de ${prenomBinome} sur la séance`} onValide={handleValideBorgBinome} />
  }

  if (phase === 'binomeObservation') {
    return (
      <ObservationFinale
        titre={`Un mot de ${prenomBinome} sur sa séance ?`}
        onValide={handleValideObservationBinome}
      />
    )
  }

  if (phase === 'bilanBloc') {
    return <BilanBloc labelBloc={labelBloc} annonceRetour={!dernierBloc} onValide={handleValideBilanBloc} />
  }

  if (phase === 'saisieDistance') {
    return (
      <SaisieDistance
        key={`saisie-${indexBloc}-${indexSegment}`}
        titre={`${labelBloc}${labelSegment} terminé${nbSegments > 1 ? 'e' : ''}`}
        dureeCourseS={resultatSegment?.dureeRealisee}
        tours={resultatSegment?.tours || 0}
        retourFinTs={dernierSegment ? null : retourFinTs}
        libelleSuite="la prochaine répétition"
        distanceInitiale={segmentsResultats.length > indexSegment ? segmentsResultats[indexSegment].distanceDeclaree : null}
        onValide={handleValideDistance}
        onPret={handleRepartir}
      />
    )
  }

  if (phase === 'finTravail') {
    return (
      <SaisieFinTravail
        distanceRealisee={resultatsCourseBloc?.distanceDeclaree ?? resultatsCourseBloc?.distanceRealisee ?? 0}
        dureeRealisee={resultatsCourseBloc?.dureeRealisee ?? 0}
        binomeNom={prenomBinome}
        onValide={handleValideFinTravail}
      />
    )
  }

  if (phase === 'recuperation') {
    return <Recuperation onTermine={handleTermineRecuperation} onPasser={handlePasserRecuperation} dejaEcouleS={dejaEcouleRecupS} dureeS={dureeRecuperationFinale(niveau, RECUPERATION_FIXE.duree_s)} />
  }

  if (phase === 'borgRecuperation') {
    return <BorgScale titre="Ton ressenti après la récupération" onValide={handleValideBorgRecuperation} />
  }

  if (phase === 'poulsFinal') {
    return (
      <PriseDePouls
        titre="Pouls final"
        binomeNom={prenomBinome}
        sousTitre="Pour clore la séance."
        onValide={handlePoulsFinal}
      />
    )
  }

  if (phase === 'finAnnonce') {
    return <FinSeanceAnnonce onTermine={handleFinAnnonceTerminee} />
  }

  return (
    <div>
      {recuperationSautee && (
        <div className="max-w-md mx-auto px-6 pt-6 -mb-2">
          <button onClick={handleReprendreRecuperation} className="text-xs text-piste-500 underline">
            ← Récupération passée par erreur ? Revenir la faire
          </button>
        </div>
      )}
      <ObservationFinale
        onValide={handleValideObservation}
        libelleBouton={binome ? `Continuer : fiche de ${prenomBinome}` : 'Terminer la séance'}
      />
    </div>
  )
}
