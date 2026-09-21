import { useEffect, useRef, useState } from 'react'
import CourseRun from './CourseRun'
import BilanBloc from './BilanBloc'
import BorgScale from './BorgScale'
import ObservationFinale from './ObservationFinale'
import Echauffement from './Echauffement'
import Recuperation from './Recuperation'
import FinSeanceAnnonce from './FinSeanceAnnonce'
import CorrectionDistance from './CorrectionDistance'
import PriseDePouls from './PriseDePouls'
import ChoixEchauffement from './ChoixEchauffement'
import SaisieFinTravail from './SaisieFinTravail'
import { calculerNoteSeance } from '../utils/calc'
import { expanserStructure, dureeTotaleStructure, distanceTotaleStructure } from '../utils/fullpower'
import { useWakeLock } from '../utils/wakeLock'
import { libelleNiveau } from '../utils/niveauLabels'

export function preparerBloc(bloc, niveau, vmaRef) {
  if (bloc.mode === 'fullpower' && bloc.structure) {
    return {
      phases: expanserStructure(bloc.structure, vmaRef),
      distanceCible: distanceTotaleStructure(bloc.structure, vmaRef),
      dureeCible: dureeTotaleStructure(bloc.structure)
    }
  }
  return {
    phases: [{ phase: 'travail', duree_s: bloc.duree_s, vitesse_kmh: bloc.allure_kmh }],
    distanceCible: bloc.distance_m,
    dureeCible: bloc.duree_s
  }
}

// Déroulement complet d'une séance : Pouls de repos → (choix Échauffement, si activé pour ce
// niveau → Échauffement → Borg) → Pouls avant travail → blocs de Travail (boucle course/bilan
// inchangée) → à la dernière répétition, saisie groupée Pouls/Distance-Temps/Observation/Borg
// (2min30, voir SaisieFinTravail) qui enchaîne directement sur la Récupération de fin de séance
// (une seule phase continue : le temps de cette saisie fait partie de la récupération, ne s'y
// ajoute pas — voir Recuperation/dejaEcouleS) → Borg récup (sauf récup sautée, avec retour arrière
// possible tant que le bilan final n'est pas validé) → Pouls final → annonce de fin → observation
// générale → fiche récapitulative.
export default function SeanceRunner({ niveau, vmaRef, reprise, onProgress, onFinSeance, onAbandon }) {
  useWakeLock(true)

  const echauffementActif = !!niveau.echauffement?.active

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
      courseStartTs: courseStartTsRef.current,
      courseEtat: phase === 'course' ? 'course' : null,
      distanceBlocEnCours: phase === 'course' ? distanceBlocEnCoursRef.current : 0
    }
  }

  useEffect(() => {
    onProgress?.(snapshotProgress())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indexBloc, phase, blocsResultats, echauffementChoisi, echauffementResultat, recuperationResultat, recuperationSautee, borgParPhase, poulsParPhase, observationTravail, dejaEcouleRecupS, resultatsCourseBloc])

  function handleCourseDemarre(ts) {
    courseStartTsRef.current = ts
    setRepriseConsommee(true)
  }

  // Remontée régulière (toutes les ~3s, via CourseRun) de la distance du bloc en cours, pour
  // que la sauvegarde de session reste à jour même sans changement de phase entre-temps.
  function handleDistanceProgress(distance) {
    distanceBlocEnCoursRef.current = distance
    onProgress?.(snapshotProgress())
  }

  const resumeStartTs =
    !repriseConsommee && phase === 'course' && reprise?.courseEtat === 'course' && reprise.indexBloc === indexBloc
      ? reprise.courseStartTs
      : null
  const resumeDistance =
    !repriseConsommee && phase === 'course' && reprise?.courseEtat === 'course' && reprise.indexBloc === indexBloc
      ? reprise.distanceBlocEnCours || 0
      : 0

  const bloc = niveau.blocs[indexBloc]
  const dernierBloc = indexBloc === niveau.blocs.length - 1
  const labelBloc = bloc ? `Bloc ${indexBloc + 1}/${niveau.blocs.length} · ${libelleNiveau(niveau.nom)}` : libelleNiveau(niveau.nom)
  const preparation = bloc ? preparerBloc(bloc, niveau, vmaRef) : null

  function handlePoulsRepos(valeur) {
    setPoulsParPhase((p) => ({ ...p, repos: valeur }))
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

  function handlePoulsAvantTravail(valeur) {
    setPoulsParPhase((p) => ({ ...p, avantTravail: valeur }))
    setPhase('course')
  }

  function handleTermineBloc(resultatCourse) {
    setResultatsCourseBloc(resultatCourse)
    // Sans GPS exploitable, on ne connaît pas réellement la distance parcourue (jusqu'ici
    // l'appli supposait silencieusement que la distance prévue avait été atteinte) : on demande
    // une estimation à l'élève avant de passer au bilan du bloc.
    setPhase(resultatCourse.viaGPS ? 'bilanBloc' : 'correctionDistance')
  }

  function handleValideCorrectionDistance(distanceCorrigee) {
    setResultatsCourseBloc((r) => {
      const distanceCible = r.distanceCible || 0
      return {
        ...r,
        distanceRealisee: distanceCorrigee,
        distanceCorrigeeManuellement: distanceCorrigee !== distanceCible,
        pctDistance: distanceCible ? Math.round(Math.min(100, (distanceCorrigee / distanceCible) * 100)) : null
      }
    })
    setPhase('bilanBloc')
  }

  function handleValideBilanBloc({ reussite, note }) {
    const blocResultat = { blocId: bloc.id, ...resultatsCourseBloc, reussite, note }
    const nouveauxResultats = [...blocsResultats, blocResultat]
    setBlocsResultats(nouveauxResultats)

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
  function handleValideFinTravail({ pouls, observation, borg, dureeEcouleeS }) {
    setPoulsParPhase((p) => ({ ...p, apresTravail: pouls }))
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

  function handlePoulsFinal(valeur) {
    setPoulsParPhase((p) => ({ ...p, final: valeur }))
    setPhase('finAnnonce')
  }

  function handleFinAnnonceTerminee() {
    setPhase('observation')
  }

  function handleValideObservation(observationGenerale) {
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
      note
    })
  }

  if (phase === 'poulsRepos') {
    return (
      <PriseDePouls
        titre="Pouls de repos"
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
        sousTitre="Juste avant de démarrer la phase de travail."
        onValide={handlePoulsAvantTravail}
      />
    )
  }

  if (phase === 'course') {
    return (
      <CourseRun
        phases={preparation.phases}
        distanceCible={preparation.distanceCible}
        dureeCible={preparation.dureeCible}
        labelBloc={labelBloc}
        onTermineBloc={handleTermineBloc}
        onAbandon={onAbandon}
        resumeStartTs={resumeStartTs}
        onDemarre={handleCourseDemarre}
        resumeDistance={resumeDistance}
        onDistanceProgress={handleDistanceProgress}
      />
    )
  }

  if (phase === 'bilanBloc') {
    return <BilanBloc labelBloc={labelBloc} onValide={handleValideBilanBloc} />
  }

  if (phase === 'correctionDistance') {
    return (
      <CorrectionDistance
        distanceCible={resultatsCourseBloc?.distanceCible}
        onValide={handleValideCorrectionDistance}
      />
    )
  }

  if (phase === 'finTravail') {
    return (
      <SaisieFinTravail
        distanceRealisee={resultatsCourseBloc?.distanceRealisee ?? 0}
        dureeRealisee={resultatsCourseBloc?.dureeRealisee ?? 0}
        onValide={handleValideFinTravail}
      />
    )
  }

  if (phase === 'recuperation') {
    return <Recuperation onTermine={handleTermineRecuperation} onPasser={handlePasserRecuperation} dejaEcouleS={dejaEcouleRecupS} dureeS={niveau.recuperation?.duree_s} />
  }

  if (phase === 'borgRecuperation') {
    return <BorgScale titre="Ton ressenti après la récupération" onValide={handleValideBorgRecuperation} />
  }

  if (phase === 'poulsFinal') {
    return (
      <PriseDePouls
        titre="Pouls final"
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
      <ObservationFinale onValide={handleValideObservation} />
    </div>
  )
}
