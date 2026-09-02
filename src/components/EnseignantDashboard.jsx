import { useMemo, useState } from 'react'
import { Download, Plus, Trash2 } from 'lucide-react'
import SeanceEditor from './SeanceEditor'
import { syntheseCycle } from '../utils/calc'

export default function EnseignantDashboard({ seances, setSeances, realisations }) {
  const [editeurOuvert, setEditeurOuvert] = useState(false)
  const [classeSelectionnee, setClasseSelectionnee] = useState('toutes')

  const classes = useMemo(() => {
    const set = new Set(realisations.map((r) => r.eleve.classe))
    return ['toutes', ...Array.from(set).sort()]
  }, [realisations])

  const realisationsFiltrees = useMemo(
    () => (classeSelectionnee === 'toutes' ? realisations : realisations.filter((r) => r.eleve.classe === classeSelectionnee)),
    [realisations, classeSelectionnee]
  )

  const parEleve = useMemo(() => {
    const map = {}
    realisationsFiltrees.forEach((r) => {
      const cle = `${r.eleve.nom}__${r.eleve.prenom}__${r.eleve.classe}`
      if (!map[cle]) map[cle] = { eleve: r.eleve, realisations: [] }
      map[cle].realisations.push(r)
    })
    return Object.values(map)
  }, [realisationsFiltrees])

  function ajouterSeance(seance) {
    setSeances([...seances, seance])
    setEditeurOuvert(false)
  }

  function supprimerSeance(id) {
    setSeances(seances.filter((s) => s.id !== id))
  }

  function exporterCSV() {
    const lignes = [['Classe', 'Nom', 'Prénom', 'Séance', 'Niveau', 'Date', 'Blocs réussis', 'Borg', 'Note', 'Observation']]
    realisationsFiltrees.forEach((r) => {
      const nbReussis = r.blocsResultats.filter((b) => b.reussite === 'reussi').length
      lignes.push([
        r.eleve.classe,
        r.eleve.nom,
        r.eleve.prenom,
        r.seanceTitre,
        r.niveauNom,
        new Date(r.date).toLocaleDateString('fr-FR'),
        `${nbReussis}/${r.blocsResultats.length}`,
        r.borg,
        r.note,
        r.observationGenerale || ''
      ])
    })
    const csv = lignes.map((l) => l.join(';')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `course-duree-pro_${classeSelectionnee}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display text-2xl text-piste-900">Espace enseignant</h2>
        <button
          onClick={() => setEditeurOuvert(true)}
          className="flex items-center gap-1.5 bg-piste-800 hover:bg-piste-700 text-white text-sm font-medium px-3.5 py-2 rounded-full transition"
        >
          <Plus size={16} /> Séance
        </button>
      </div>

      <section className="mb-8">
        <h3 className="text-xs font-semibold tracking-wide text-piste-500 uppercase mb-3">Bibliothèque de séances</h3>
        {seances.length === 0 && <p className="text-sm text-piste-500">Aucune séance créée pour l'instant.</p>}
        <div className="space-y-2">
          {seances.map((s) => (
            <div key={s.id} className="flex items-center justify-between bg-white border border-piste-100 rounded-xl px-4 py-3">
              <div>
                <p className="text-sm font-medium text-piste-900">{s.titre}</p>
                <p className="text-xs text-piste-500">{s.niveaux.length} niveaux · {s.visible ? 'Visible aux élèves' : 'Masquée'}</p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setSeances(seances.map((sv) => (sv.id === s.id ? { ...sv, visible: !sv.visible } : sv)))}
                  className={`text-[11px] font-medium px-2.5 py-1.5 rounded-full border transition ${s.visible ? 'bg-piste-800 text-white border-piste-800' : 'border-piste-200 text-piste-700'}`}
                >
                  {s.visible ? 'Visible' : 'Masquée'}
                </button>
                <button onClick={() => supprimerSeance(s.id)} className="p-1.5 rounded-full hover:bg-[#fbeeea] text-alerte">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold tracking-wide text-piste-500 uppercase">Suivi de cycle</h3>
          <button onClick={exporterCSV} className="flex items-center gap-1.5 text-xs font-medium text-piste-700 hover:text-piste-900">
            <Download size={14} /> Exporter CSV
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto mb-4 pb-1">
          {classes.map((c) => (
            <button
              key={c}
              onClick={() => setClasseSelectionnee(c)}
              className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border transition ${classeSelectionnee === c ? 'bg-piste-800 text-white border-piste-800' : 'border-piste-200 text-piste-600'}`}
            >
              {c === 'toutes' ? 'Toutes les classes' : c}
            </button>
          ))}
        </div>

        {parEleve.length === 0 && <p className="text-sm text-piste-500">Aucune séance réalisée pour l'instant.</p>}

        <div className="space-y-2">
          {parEleve.map(({ eleve, realisations: r }) => {
            const synth = syntheseCycle(r)
            return (
              <div key={`${eleve.nom}-${eleve.prenom}-${eleve.classe}`} className="flex items-center justify-between bg-piste-50 rounded-xl px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-piste-900">{eleve.prenom} {eleve.nom}</p>
                  <p className="text-xs text-piste-500">{eleve.classe} · {synth.nbSeances} séance{synth.nbSeances > 1 ? 's' : ''}</p>
                </div>
                <span className="font-display text-lg text-piste-900">{synth.moyenne}/20</span>
              </div>
            )
          })}
        </div>
      </section>

      {editeurOuvert && <SeanceEditor onEnregistrer={ajouterSeance} onFermer={() => setEditeurOuvert(false)} />}
    </div>
  )
}
