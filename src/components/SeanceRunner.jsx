import { useState } from 'react'
import CourseRun from './CourseRun'
import BilanBloc from './BilanBloc'
import BorgScale from './BorgScale'
import ObservationFinale from './ObservationFinale'
import Echauffement from './Echauffement'
import FinSeanceAnnonce from './FinSeanceAnnonce'
import { calculerNoteSeance } from '../utils/calc'
import { expanserStructure, dureeTotaleStructure, distanceTotaleStructure } from '../utils/fullpower'

function preparerBloc(bloc, niveau, vmaRef) {
  if (bloc.mode === 'fullpower' && bloc.structure) {
    return {
      phases: expanserStructure(bloc.structure, vmaRef),
      guidage: bloc.structure.guidage,
      distanceCible: distanceTotaleStructure(bloc.structure, vmaRef),
      dureeCible: dureeTotaleStructure(bloc.structure)
    }
  }
  return {
    phases: [{ phase: 'travail', duree_s: bloc.duree_s, vitesse_kmh: bloc.allure_kmh }],
    guidage: niveau.guidage,
    distanceCible: bloc.distance_m,
    dureeCible: bloc.duree_s
  }
}

export default function SeanceRunner({ niveau, vmaRef, onFinSeance, onAbandon }) {
  const [indexBloc, setIndexBloc] = useState(0)
  const [phase, setPhase] = useState(() => (niveau.echauffement?.active ? 'echauffement' : 'course'))
  const [resultatsCourseBloc, setResultatsCourseBloc] = useState(null)
  const [blocsResultats, setBlocsResultats] = useState([])
  const [borg, setBorg] = useState(null)

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
        guidage={preparation.guidage}
        distanceCible={preparation.distanceCible}
        dureeCible={preparation.dureeCible}
        labelBloc={labelBloc}
        onTermineBloc={handleTermineBloc}
        onAbandon={onAbandon}
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
