import { useEffect, useMemo, useState } from 'react'
import { X, Search, ArrowRightLeft, RefreshCw } from 'lucide-react'
import { storage } from '../utils/storage'
import { loadRealisationsTeacher, loadRosterTeacher } from '../utils/cloud'
import { libelleNiveau } from '../utils/niveauLabels'
import { normaliser } from '../utils/eleves'
import RecreerRun from './RecreerRun'

const dateHeure = (ts) =>
  ts ? new Date(ts).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'

function idsRoster(roster) {
  const s = new Set()
  Object.values(roster || {}).forEach((eleves) => eleves.forEach((e) => s.add(e.id)))
  return s
}

// Recherche de secours : relit en ligne TOUTES les séances réalisées (mon espace + celui de chaque
// collègue pour l'admin), indique à quel élève chacune est rattachée et si cet élève existe encore
// dans la liste. Une séance de mon espace rattachée à un élève disparu peut être rattachée à un
// élève existant en un clic.
export default function RechercheSeances({ espaceActifId, accesConfig, estAdmin, onFermer, onTermine }) {
  const [chargement, setChargement] = useState(true)
  const [lignes, setLignes] = useState([])
  const [filtre, setFiltre] = useState('run')
  const [recherche, setRecherche] = useState('')
  const [message, setMessage] = useState(null)
  const [recreationOuverte, setRecreationOuverte] = useState(false)

  const espaces = useMemo(() => {
    const liste = [{ id: espaceActifId, nom: 'Espace consulté' }]
    if (estAdmin) {
      if (espaceActifId !== 'admin') liste.push({ id: 'admin', nom: accesConfig?.nomAdmin || 'Admin' })
      ;(accesConfig?.collegues || []).forEach((c) => { if (c.id !== espaceActifId) liste.push({ id: c.id, nom: c.nom }) })
    }
    return liste
  }, [espaceActifId, accesConfig, estAdmin])

  async function charger() {
    setChargement(true)
    const res = await Promise.all(
      espaces.map(async (esp) => {
        const [reals, roster] = await Promise.all([loadRealisationsTeacher(esp.id), loadRosterTeacher(esp.id)])
        const ids = idsRoster(roster)
        return reals.map((r) => ({ r, espace: esp, eleveExiste: !r.eleve?.id || ids.has(r.eleve.id) }))
      })
    )
    setLignes(res.flat().sort((a, b) => (b.r.date || 0) - (a.r.date || 0)))
    setChargement(false)
  }
  useEffect(() => { charger() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const visibles = lignes.filter(({ r, eleveExiste }) => {
    if (filtre === 'run' && !r.runDirect) return false
    if (filtre === 'orphelins' && eleveExiste) return false
    const q = normaliser(recherche)
    if (q && !normaliser(`${r.eleve?.prenom} ${r.eleve?.nom} ${r.eleve?.classe} ${r.seanceTitre}`).includes(q)) return false
    return true
  })

  // Cible proposée pour rattacher : C. Guilhem de PROF s'il existe dans l'espace consulté
  const cibleProf = (storage.getElevesClasse('PROF') || []).find((e) => normaliser(`${e.prenom} ${e.nom}`).includes('guilhem'))

  async function rattacher(r) {
    if (!cibleProf) return
    if (!confirm(`Rattacher cette séance du ${dateHeure(r.date)} à ${cibleProf.prenom} ${cibleProf.nom} (PROF) ?`)) return
    const res = await storage.transfererVersEleve({
      sources: [],
      cible: { id: cibleProf.id },
      realisationIds: [r.id],
      vmaSelection: {},
      supprimerSourcesVides: false
    })
    setMessage(res.nbRealisations ? `Séance rattachée à ${cibleProf.prenom} ${cibleProf.nom} ✓` : 'Séance introuvable dans l’espace consulté.')
    onTermine()
    charger()
  }

  const bouton = (id, label) => (
    <button
      key={id}
      onClick={() => setFiltre(id)}
      className={`text-xs font-medium px-3 py-1.5 rounded-full ${filtre === id ? 'bg-piste-800 text-white' : 'bg-piste-50 text-piste-600'}`}
    >
      {label}
    </button>
  )

  return (
    <div className="fixed inset-0 bg-black/40 z-30 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-white px-4 py-4 border-b border-piste-100 z-10 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Search size={18} className="text-piste-700" />
              <h3 className="font-display text-lg text-piste-900">Retrouver une séance</h3>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={charger} className="p-1.5 text-piste-500 hover:text-piste-900" aria-label="Relire">
                <RefreshCw size={18} className={chargement ? 'animate-spin' : ''} />
              </button>
              <button onClick={onFermer} className="p-1.5 text-piste-500 hover:text-piste-900" aria-label="Fermer">
                <X size={20} />
              </button>
            </div>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {bouton('run', 'Runs libres')}
            {bouton('orphelins', 'Élève disparu')}
            {bouton('tout', 'Toutes')}
          </div>
          <input
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Filtrer par nom, classe, titre…"
            className="w-full rounded-xl border border-piste-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-piste-500"
          />
          {message && <p className="text-xs font-medium text-piste-700">{message}</p>}
        </div>

        <div className="px-4 py-3 space-y-2">
          {recreationOuverte && cibleProf ? (
            <RecreerRun
              espaceId={espaceActifId}
              eleve={{ ...cibleProf, classe: 'PROF' }}
              onAnnuler={() => setRecreationOuverte(false)}
              onFait={() => {
                setRecreationOuverte(false)
                setMessage(`Run recréé dans la fiche de ${cibleProf.prenom} ${cibleProf.nom} ✓`)
                onTermine()
                charger()
              }}
            />
          ) : cibleProf ? (
            <button
              onClick={() => setRecreationOuverte(true)}
              className="w-full text-sm font-medium text-piste-800 border border-dashed border-piste-300 rounded-xl py-2.5"
            >
              + Recréer un run perdu pour {cibleProf.prenom} {cibleProf.nom} (PROF)
            </button>
          ) : null}
          {chargement ? (
            <p className="text-sm text-piste-500 py-6 text-center">Lecture des séances en ligne…</p>
          ) : visibles.length === 0 ? (
            <p className="text-sm text-piste-500 py-6 text-center">Aucune séance ne correspond ({lignes.length} séances lues au total).</p>
          ) : (
            visibles.map(({ r, espace, eleveExiste }) => {
              const autreEspace = espace.id !== espaceActifId
              const rd = r.runDirect
              return (
                <div key={`${espace.id}:${r.id}`} className={`rounded-xl px-3 py-2.5 border ${eleveExiste ? 'border-piste-100' : 'border-alerte'}`}>
                  <p className="text-sm font-medium text-piste-900">
                    {r.seanceTitre || 'Séance'}{r.niveauNom ? ` · ${libelleNiveau(r.niveauNom)}` : ''}
                  </p>
                  <p className="text-xs text-piste-600">
                    {dateHeure(r.date)}
                    {rd?.distanceGlobaleM ? ` · ${(rd.distanceGlobaleM / 1000).toFixed(2).replace('.', ',')} km` : ''}
                    {rd?.dureeGlobaleMs ? ` · ${Math.round(rd.dureeGlobaleMs / 60000)} min` : ''}
                  </p>
                  <p className="text-xs text-piste-500">
                    {r.eleve?.prenom} {r.eleve?.nom} ({r.eleve?.classe || 'sans classe'})
                    {autreEspace && <span className="font-medium text-piste-700"> · espace de {espace.nom}</span>}
                  </p>
                  {!eleveExiste && (
                    <div className="flex items-center justify-between gap-2 mt-1.5">
                      <span className="text-[11px] font-medium text-alerte">Élève plus dans la liste : séance invisible ailleurs</span>
                      {!autreEspace && cibleProf && (
                        <button onClick={() => rattacher(r)} className="flex items-center gap-1 text-xs font-medium text-piste-800 shrink-0">
                          <ArrowRightLeft size={13} /> Rattacher à {cibleProf.prenom} {cibleProf.nom}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
