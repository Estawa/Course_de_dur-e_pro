import { useEffect, useRef, useState } from 'react'
import CourseRun from './CourseRun'
import BilanBloc from './BilanBloc'
import BorgScale from './BorgScale'
import ObservationFinale from './ObservationFinale'
import Echauffement from './Echauffement'
import FinSeanceAnnonce from './FinSeanceAnnonce'
import { calculerNoteSeance } from '../utils/calc'
import { expanserStructure, dureeTotaleStructure, distanceTotaleStructure } from '../utils/fullpower'
import { useWakeLock } from '../utils/wakeLock'

// Le guidage GPS est désormais toujours tenté automatiquement par CourseRun (repli invisible sur
// minuteur si indisponible) : plus besoin de choisir un mode de guidage ici.
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

// reprise : snapshot sauvegardé (voir storage.sauvegarderSessionCours) si la séance avait été
// interrompue par une fermeture/mise en veille prolongée de l'appli ; null pour un démarrage normal.
// onProgress : appelé à chaque étape franchie pour que le parent persiste la progression.
export default function SeanceRunner({ niveau, vmaRef, reprise, onProgress, onFinSeance, onAbandon }) {
  useWakeLock(true) // empêche l'écran de s'éteindre pendant toute la durée de la séance

  const [indexBloc, setIndexBloc] = useState(() => reprise?.indexBloc ?? 0)
  const [phase, setPhase] = useState(() => reprise?.phase ?? (niveau.echauffement?.active ? 'echauffement' : 'course'))
  const [resultatsCourseBloc, setResultatsCourseBloc] = useState(() => reprise?.resultatsCourseBloc ?? null)
  const [blocsResultats, setBlocsResultats] = useState(() => reprise?.blocsResultats ?? [])
  const [borg, setBorg] = useState(() => reprise?.borg ?? null)
  // Le timestamp réel de départ du bloc de course en cours (pour que le chrono reprenne pile là
  // où il en était après une fermeture/mise en veille, au lieu de repartir de zéro).
  const courseStartTsRef = useRef(reprise?.courseEtat === 'course' ? reprise.courseStartTs : null)
  const [repriseConsommee, setRepriseConsommee] = useState(false)

  useEffect(() => {
    onProgress?.({
      indexBloc,
      phase,
      blocsResultats,
      borg,
      resultatsCourseBloc,
      courseStartTs: courseStartTsRef.current,
      courseEtat: phase === 'course' ? 'course' : null
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indexBloc, phase, blocsResultats, borg, resultatsCourseBloc])

  function handleCourseDemarre(ts) {
    courseStartTsRef.current = ts
    setRepriseConsommee(true)
    onProgress?.({
      indexBloc,
      phase: 'course',
      blocsResultats,
      borg,
      resultatsCourseBloc,
      courseStartTs: ts,
      courseEtat: 'course'
    })
  }

  const resumeStartTs =
    !repriseConsommee && phase === 'course' && reprise?.courseEtat === 'course' && reprise.indexBloc === indexBloc
      ? reprise.courseStartTs
      : null

  const bloc = niveau.blocs[indexBloc]
  const dernierBloc = indexBloc === niveau.blocs.length - 1
  const labelBloc = `Bloc ${indexBloc + 1}/${niveau.blocs.length} · ${niveau.nom}`
  const preparation = preparerBloc(bloc, niveau, vmaRef)

  function handleTermineBloc(resultatCourse) {
    setResultatsCourseBloc(resultatCourse)
    setPhase('bilanBloc')
  }

  function handleValideBilanBloc({ reussite, note }) {
    const blocResultat = { blocId: bloc.id, ...resultatsCourseBloc, reussite, note }
    const nouveauxResultats = [...blocsResultats, blocResultat]
    setBlocsResultats(nouveauxResultats)

    if (dernierBloc) {
      setPhase('finAnnonce')
    } else {
      setIndexBloc((i) => i + 1)
      setPhase('course')
      setResultatsCourseBloc(null)
    }
  }

  function handleFinAnnonceTerminee() {
    setPhase('borg')
  }

  function handleValideBorg(valeurBorg) {
    setBorg(valeurBorg)
    setPhase('observation')
  }

  function handleValideObservation(observationGenerale) {
    const note = calculerNoteSeance(blocsResultats)
    onFinSeance({ blocsResultats, borg, observationGenerale, note })
  }

  if (phase === 'echauffement') {
    return <Echauffement duree_s={niveau.echauffement.duree_s} onTermine={() => setPhase('course')} />
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

  if (phase === 'finAnnonce') {
    return <FinSeanceAnnonce onTermine={handleFinAnnonceTerminee} />
  }

  if (phase === 'borg') {
    return <BorgScale onValide={handleValideBorg} />
  }

  return <ObservationFinale onValide={handleValideObservation} />
}
