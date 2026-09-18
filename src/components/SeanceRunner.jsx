import { useEffect, useRef, useState } from 'react'
import CourseRun from './CourseRun'
import BilanBloc from './BilanBloc'
import BorgScale from './BorgScale'
import ObservationFinale from './ObservationFinale'
import Echauffement from './Echauffement'
import Recuperation from './Recuperation'
import FinSeanceAnnonce from './FinSeanceAnnonce'
import { calculerNoteSeance } from '../utils/calc'
import { expanserStructure, dureeTotaleStructure, distanceTotaleStructure } from '../utils/fullpower'
import { useWakeLock } from '../utils/wakeLock'

function preparerBloc(bloc, niveau, vmaRef) {
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

// Déroulement complet d'une séance : Échauffement (si activé pour ce niveau) → Borg → blocs de
// Travail (boucle course/bilan existante, inchangée) → Borg → Récupération de fin de séance
// (skippable, avec retour arrière possible en cas d'erreur de manipulation, tant que le bilan
// final n'est pas validé) → Borg (sauf récup sautée) → annonce de fin → observation générale.
export default function SeanceRunner({ niveau, vmaRef, reprise, onProgress, onFinSeance, onAbandon }) {
  useWakeLock(true)

  const echauffementActif = !!niveau.echauffement?.active

  const [indexBloc, setIndexBloc] = useState(() => reprise?.indexBloc ?? 0)
  const [phase, setPhase] = useState(() => reprise?.phase ?? (echauffementActif ? 'echauffement' : 'course'))
  const [resultatsCourseBloc, setResultatsCourseBloc] = useState(() => reprise?.resultatsCourseBloc ?? null)
  const [blocsResultats, setBlocsResultats] = useState(() => reprise?.blocsResultats ?? [])
  const [echauffementResultat, setEchauffementResultat] = useState(() => reprise?.echauffementResultat ?? null)
  const [recuperationResultat, setRecuperationResultat] = useState(() => reprise?.recuperationResultat ?? null)
  const [recuperationSautee, setRecuperationSautee] = useState(() => reprise?.recuperationSautee ?? false)
  const [borgParPhase, setBorgParPhase] = useState(() => reprise?.borgParPhase ?? { echauffement: null, travail: null, recuperation: null })
  const courseStartTsRef = useRef(reprise?.courseEtat === 'course' ? reprise.courseStartTs : null)
  const [repriseConsommee, setRepriseConsommee] = useState(false)

  useEffect(() => {
    onProgress?.({
      indexBloc,
      phase,
      blocsResultats,
      echauffementResultat,
      recuperationResultat,
      recuperationSautee,
      borgParPhase,
      resultatsCourseBloc,
      courseStartTs: courseStartTsRef.current,
      courseEtat: phase === 'course' ? 'course' : null
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indexBloc, phase, blocsResultats, echauffementResultat, recuperationResultat, recuperationSautee, borgParPhase, resultatsCourseBloc])

  function handleCourseDemarre(ts) {
    courseStartTsRef.current = ts
    setRepriseConsommee(true)
  }

  const resumeStartTs =
    !repriseConsommee && phase === 'course' && reprise?.courseEtat === 'course' && reprise.indexBloc === indexBloc
      ? reprise.courseStartTs
      : null

  const bloc = niveau.blocs[indexBloc]
  const dernierBloc = indexBloc === niveau.blocs.length - 1
  const labelBloc = bloc ? `Bloc ${indexBloc + 1}/${niveau.blocs.length} · ${niveau.nom}` : niveau.nom
  const preparation = bloc ? preparerBloc(bloc, niveau, vmaRef) : null

  function handleTermineEchauffement(resultat) {
    setEchauffementResultat(resultat)
    setPhase('borgEchauffement')
  }

  function handleValideBorgEchauffement(valeur) {
    setBorgParPhase((p) => ({ ...p, echauffement: valeur }))
    setPhase('course')
  }

  function handleTermineBloc(resultatCourse) {
    setResultatsCourseBloc(resultatCourse)
    setPhase('bilanBloc')
  }

  function handleValideBilanBloc({ reussite, note }) {
    const blocResultat = { blocId: bloc.id, ...resultatsCourseBloc, reussite, note }
    const nouveauxResultats = [...blocsResultats, blocResultat]
    setBlocsResultats(nouveauxResultats)

    if (dernierBloc) {
      setPhase('borgTravail')
    } else {
      setIndexBloc((i) => i + 1)
      setPhase('course')
      setResultatsCourseBloc(null)
    }
  }

  function handleValideBorgTravail(valeur) {
    setBorgParPhase((p) => ({ ...p, travail: valeur }))
    setPhase('recuperation')
  }

  function handleTermineRecuperation(resultat) {
    setRecuperationResultat(resultat)
    setRecuperationSautee(false)
    setPhase('borgRecuperation')
  }

  function handlePasserRecuperation() {
    setRecuperationSautee(true)
    setPhase('finAnnonce')
  }

  function handleValideBorgRecuperation(valeur) {
    setBorgParPhase((p) => ({ ...p, recuperation: valeur }))
    setPhase('finAnnonce')
  }

  function handleReprendreRecuperation() {
    setRecuperationSautee(false)
    setRecuperationResultat(null)
    setPhase('recuperation')
  }

  function handleFinAnnonceTerminee() {
    setPhase('observation')
  }

  function handleValideObservation(observationGenerale) {
    const note = calculerNoteSeance(blocsResultats)
    onFinSeance({
      blocsResultats,
      echauffementResultat,
      recuperationResultat,
      recuperationSautee,
      borgParPhase,
      borg: borgParPhase.recuperation ?? borgParPhase.travail ?? borgParPhase.echauffement ?? null,
      observationGenerale,
      note
    })
  }

  if (phase === 'echauffement') {
    return <Echauffement onTermine={handleTermineEchauffement} />
  }

  if (phase === 'borgEchauffement') {
    return <BorgScale titre="Ton ressenti après l'échauffement" onValide={handleValideBorgEchauffement} />
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
      />
    )
  }

  if (phase === 'bilanBloc') {
    return <BilanBloc labelBloc={labelBloc} onValide={handleValideBilanBloc} />
  }

  if (phase === 'borgTravail') {
    return <BorgScale titre="Ton ressenti après le travail" onValide={handleValideBorgTravail} />
  }

  if (phase === 'recuperation') {
    return <Recuperation onTermine={handleTermineRecuperation} onPasser={handlePasserRecuperation} />
  }

  if (phase === 'borgRecuperation') {
    return <BorgScale titre="Ton ressenti après la récupération" onValide={handleValideBorgRecuperation} />
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
