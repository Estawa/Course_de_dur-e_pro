import { AlertTriangle, ArrowLeftRight } from 'lucide-react'
import { calculerNoteReelle } from '../utils/calc'
import { storage } from '../utils/storage'
import { formatKmM } from '../utils/guidage'

// Fiche de suivi (professeur) : contrôle de la distance déclarée par l'élève face à la mesure
// GPS. En cas d'écart (> 5 % et ≥ 50 m), la mesure GPS a été retenue automatiquement pour la
// note ; le professeur peut basculer sur la distance déclarée (ou revenir au GPS).
function appliquerSource(bloc, source) {
  if (bloc.distanceDeclaree == null || bloc.distanceGPS == null) return bloc
  const d = source === 'gps' ? bloc.distanceGPS : bloc.distanceDeclaree
  const cible = bloc.distanceCible || 0
  return {
    ...bloc,
    distanceRealisee: d,
    sourceDistance: source,
    pctDistance: cible ? Math.round(Math.min(100, (d / cible) * 100)) : bloc.pctDistance,
    termine: !!bloc.finAutomatique || (cible ? d >= cible * 0.95 : bloc.termine)
  }
}

export default function ControleDistance({ realisation, onModifier }) {
  const blocs = realisation.blocsResultats || []
  const concernes = blocs.filter((b) => b.distanceDeclaree != null && b.distanceGPS != null)
  if (!concernes.length) return null
  const alerte = concernes.some((b) => b.alerteDistance)
  const totalDeclare = concernes.reduce((a, b) => a + b.distanceDeclaree, 0)
  const totalGps = concernes.reduce((a, b) => a + b.distanceGPS, 0)
  const sourceActuelle = concernes.some((b) => b.sourceDistance === 'gps') ? 'gps' : 'declaree'
  if (!alerte && sourceActuelle === 'declaree') return null

  function basculer() {
    const nouvelle = sourceActuelle === 'gps' ? 'declaree' : 'gps'
    const blocsMaj = blocs.map((b) => appliquerSource(b, nouvelle))
    const { note, avecGps } = calculerNoteReelle({ ...realisation, blocsResultats: blocsMaj }, storage.getBareme())
    onModifier?.(realisation.id, { blocsResultats: blocsMaj, noteReelle: note, noteReelleAvecGps: avecGps })
  }

  return (
    <div className="mt-2 border border-cendre bg-[#f7f2e8] rounded-lg px-2.5 py-2">
      <p className="flex items-center gap-1 text-[11px] font-medium text-piste-900">
        <AlertTriangle size={12} className="text-alerte" /> Écart distance déclarée / GPS
      </p>
      <p className="text-[11px] text-piste-600 mt-0.5">
        Déclarée {formatKmM(totalDeclare)} · GPS {formatKmM(totalGps)} · retenue pour la note : {sourceActuelle === 'gps' ? 'GPS' : 'déclarée'}
      </p>
      {onModifier && (
        <button onClick={basculer} className="flex items-center gap-1 text-[11px] font-medium text-piste-700 mt-1.5">
          <ArrowLeftRight size={12} /> Retenir la distance {sourceActuelle === 'gps' ? 'déclarée' : 'GPS'}
        </button>
      )}
    </div>
  )
}
