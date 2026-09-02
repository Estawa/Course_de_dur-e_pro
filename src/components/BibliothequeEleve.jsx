import { CheckCircle2, ChevronRight, Timer } from 'lucide-react'
import { syntheseCycle } from '../utils/calc'

export default function BibliothequeEleve({ seances, realisations, onChoisirSeance }) {
  const seancesVisibles = seances.filter((s) => s.visible)
  const synthese = syntheseCycle(realisations)

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <h2 className="font-display text-2xl text-piste-900 mb-4">Bibliothèque</h2>

      <h3 className="text-xs font-semibold tracking-wide text-piste-500 uppercase mb-3">Séances proposées</h3>
      {seancesVisibles.length === 0 && (
        <div className="text-center py-10 text-piste-500 mb-6">
          <Timer size={28} className="mx-auto mb-2 text-piste-300" />
          <p className="text-sm">Aucune séance visible pour le moment.</p>
        </div>
      )}
      <div className="space-y-3 mb-8">
        {seancesVisibles.map((seance) => (
          <button
            key={seance.id}
            onClick={() => onChoisirSeance(seance)}
            className="w-full text-left bg-white border border-piste-100 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-piste-300 transition flex items-center justify-between"
          >
            <div>
              <p className="font-display text-lg text-piste-900">{seance.titre}</p>
              <p className="text-xs text-piste-500 mt-0.5">{seance.niveaux.length} niveaux au choix</p>
            </div>
            <ChevronRight size={18} className="text-piste-400 shrink-0" />
          </button>
        ))}
      </div>

      <h3 className="text-xs font-semibold tracking-wide text-piste-500 uppercase mb-3">Mon historique</h3>
      {synthese && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          <StatCard label="Moyenne" valeur={`${synthese.moyenne}/20`} />
          <StatCard label="Séances" valeur={synthese.nbSeances} />
          <StatCard label="Progression" valeur={`${synthese.progression >= 0 ? '+' : ''}${synthese.progression}`} />
        </div>
      )}
      {realisations.length === 0 && <p className="text-sm text-piste-500 text-center py-8">Tu n'as pas encore réalisé de séance.</p>}
      <div className="space-y-3">
        {[...realisations].reverse().map((r) => {
          const nbReussis = r.blocsResultats.filter((b) => b.reussite === 'reussi').length
          return (
            <div key={r.id} className="bg-white border border-piste-100 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="font-medium text-piste-900 text-sm">{r.seanceTitre} · {r.niveauNom}</p>
                <p className="text-xs text-piste-500 mt-0.5">{new Date(r.date).toLocaleDateString('fr-FR')}</p>
                <div className="flex items-center gap-3 mt-1.5">
                  <span className="flex items-center gap-1 text-xs text-piste-600">
                    <CheckCircle2 size={13} className="text-piste-600" />
                    {nbReussis}/{r.blocsResultats.length} blocs réussis
                  </span>
                  <span className="text-xs text-piste-600">Borg {r.borg}/10</span>
                </div>
              </div>
              <span className="font-display text-xl text-piste-900">{r.note}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function StatCard({ label, valeur }) {
  return (
    <div className="bg-piste-50 rounded-xl p-3 text-center">
      <p className="font-display text-xl text-piste-900">{valeur}</p>
      <p className="text-[11px] text-piste-500 uppercase tracking-wide">{label}</p>
    </div>
  )
}
