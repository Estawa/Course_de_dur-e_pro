import { CheckCircle2, ChevronRight, Timer, Gauge, MapPin, ListChecks } from 'lucide-react'
import { syntheseCycle, seanceVisiblePourClasse } from '../utils/calc'
import { storage } from '../utils/storage'
import { TESTS_CATALOGUE } from '../utils/testsCatalogue'
import { formatDuree } from '../utils/calc'
import { LABEL_TEST } from './VmaEleveLigne'

export default function BibliothequeEleve({ seances, realisations, eleve, onChoisirSeance, onLancerFartlek }) {
  const seancesVisibles = seances.filter((s) => seanceVisiblePourClasse(s, eleve?.classe))
  const synthese = syntheseCycle(realisations)
  const historiqueTests = eleve ? storage.getHistoriqueTests(eleve) : []
  const historiqueFartlek = eleve ? storage.getHistoriqueFartlek(eleve) : []

  const testsVisibilite = storage.getTestsVisibilite()
  const testsAnnonces = TESTS_CATALOGUE.filter((t) => {
    const v = testsVisibilite[t.id]
    return v && Array.isArray(v.classesVisibles) && v.classesVisibles.includes(eleve?.classe)
  })

  // Fusion chronologique (plus récent en premier) des séances réalisées, des tests VMA passés
  // et des évaluations Fartlek passées (sans jamais exposer leur note ici).
  const evenements = [
    ...realisations.map((r) => ({ type: 'seance', date: r.date, data: r })),
    ...historiqueTests.map((h) => ({ type: 'test', date: h.date, data: h })),
    ...historiqueFartlek.map((h) => ({ type: 'fartlek', date: h.date, data: h }))
  ].sort((a, b) => b.date - a.date)

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
              <p className="text-xs text-piste-500 mt-0.5">
                {seance.niveaux.filter((n) => n.visible !== false).length} niveaux au choix
              </p>
            </div>
            <ChevronRight size={18} className="text-piste-400 shrink-0" />
          </button>
        ))}
      </div>

      {testsAnnonces.length > 0 && (
        <>
          <h3 className="text-xs font-semibold tracking-wide text-piste-500 uppercase mb-3">Tests à venir</h3>
          <div className="space-y-3 mb-8">
            {testsAnnonces.map((t) => {
              const estFartlek = t.id === 'fartlek'
              return (
                <div key={t.id} className="bg-white border border-piste-100 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-1.5">
                    <ListChecks size={15} className="text-piste-500 shrink-0" />
                    <p className="font-display text-base text-piste-900">{t.titre}</p>
                  </div>
                  <p className="text-sm text-piste-700 mb-1"><span className="font-medium">Objectif : </span>{t.objectif}</p>
                  <p className="text-xs text-piste-500 mb-2">{t.deroulement}</p>
                  {t.niveaux && (
                    <ul className="space-y-0.5 mb-2">
                      {t.niveaux.map((n) => (
                        <li key={n.nom} className="text-xs text-piste-600">
                          <span className="font-medium">{n.nom}</span> — {n.description}
                        </li>
                      ))}
                    </ul>
                  )}
                  {estFartlek ? (
                    <button
                      onClick={onLancerFartlek}
                      className="mt-1 flex items-center gap-1.5 text-xs font-medium text-piste-800 bg-piste-50 rounded-full px-3 py-1.5"
                    >
                      <MapPin size={13} /> Réaliser ce test
                    </button>
                  ) : (
                    <p className="text-[11px] text-piste-400">Disponible dans Outils → Tests de VMA</p>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      <h3 className="text-xs font-semibold tracking-wide text-piste-500 uppercase mb-3">Mon historique</h3>
      {synthese && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          <StatCard label="Moyenne" valeur={`${synthese.moyenne}/20`} />
          <StatCard label="Séances" valeur={synthese.nbSeances} />
          <StatCard label="Progression" valeur={`${synthese.progression >= 0 ? '+' : ''}${synthese.progression}`} />
        </div>
      )}
      {evenements.length === 0 && <p className="text-sm text-piste-500 text-center py-8">Tu n'as pas encore réalisé de séance ni de test.</p>}
      <div className="space-y-3">
        {evenements.map((ev) => {
          if (ev.type === 'seance') {
            const r = ev.data
            const nbReussis = r.blocsResultats.filter((b) => b.reussite === 'reussi').length
            return (
              <div key={`s-${r.id}`} className="bg-white border border-piste-100 rounded-xl p-4 flex items-center justify-between">
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
          }
          if (ev.type === 'fartlek') {
            const h = ev.data
            return (
              <div key={`f-${h.id}`} className="bg-white border border-piste-100 rounded-xl p-4">
                <p className="font-medium text-piste-900 text-sm">Fartlek sur piste · {h.niveauNom}</p>
                <p className="text-xs text-piste-500 mt-0.5">{new Date(h.date).toLocaleDateString('fr-FR')}</p>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-piste-600 flex-wrap">
                  <span className="flex items-center gap-1"><MapPin size={13} /> {h.distanceReelleM} m</span>
                  <span>{formatDuree(h.dureeEffectiveS)} de course effective</span>
                  <span>Borg {h.borg}/10</span>
                </div>
              </div>
            )
          }
          const h = ev.data
          return (
            <div key={`t-${h.date}`} className="bg-white border border-piste-100 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="font-medium text-piste-900 text-sm">Test VMA · {LABEL_TEST[h.test] || h.test}</p>
                <p className="text-xs text-piste-500 mt-0.5">{new Date(h.date).toLocaleDateString('fr-FR')}</p>
                <div className="flex items-center gap-1 mt-1.5 text-xs text-piste-600">
                  <Gauge size={13} className="text-piste-600" />
                  Résultat du test
                </div>
              </div>
              <span className="font-display text-xl text-piste-900">{h.valeur} km/h</span>
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
