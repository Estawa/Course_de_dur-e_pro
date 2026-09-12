import { useEffect, useMemo, useState } from 'react'
import { Download, Plus, Trash2, Upload, ChevronRight, FolderPlus, FolderX, UserPlus, Sparkles, GripVertical } from 'lucide-react'
import SeanceEditor from './SeanceEditor'
import ImportEleves from './ImportEleves'
import VmaEleveLigne, { LABEL_TEST, formatDateVma } from './VmaEleveLigne'
import FicheSuiviEleve from './FicheSuiviEleve'
import VisibiliteClasses from './VisibiliteClasses'
import { storage } from '../utils/storage'
import { noteFinale, pourcentagesReussite } from '../utils/calc'
import { genererSeancesTypesSecondes } from '../utils/seancesTypesSecondes'
import { TESTS_CATALOGUE } from '../utils/testsCatalogue'

const GROUPES_SCOLAIRES = [
  { id: 'seconde', label: 'Secondes' },
  { id: 'premiere_terminale', label: 'Premières / Terminales' }
]

export default function EnseignantDashboard({ seances, setSeances, realisations, onModifierRealisation, onSupprimerRealisation, onSupprimerRealisationsEleve, onSupprimerRealisationsClasse, cloudTick }) {
  const [onglet, setOnglet] = useState('seances') // seances | suivi | vma
  const [editeurOuvert, setEditeurOuvert] = useState(false)
  const [seanceEnEdition, setSeanceEnEdition] = useState(null)
  const [seancePourVisibilite, setSeancePourVisibilite] = useState(null)
  const [importOuvert, setImportOuvert] = useState(false)
  const [rosterVersion, setRosterVersion] = useState(0) // force refresh après import/suppression
  const [classeSelectionnee, setClasseSelectionnee] = useState(null)
  const [eleveFicheOuverte, setEleveFicheOuverte] = useState(null) // clé de l'élève dont la fiche de suivi est ouverte
  const [ajoutEleveOuvert, setAjoutEleveOuvert] = useState(false)
  const [nouvelEleveNom, setNouvelEleveNom] = useState('')
  const [nouvelElevePrenom, setNouvelElevePrenom] = useState('')
  const [nouvelEleveSexe, setNouvelEleveSexe] = useState('')
  const [nouvelleClasseOuverte, setNouvelleClasseOuverte] = useState(false)
  const [nouvelleClasseNom, setNouvelleClasseNom] = useState('')
  const [draggedId, setDraggedId] = useState(null)
  const [testPourVisibilite, setTestPourVisibilite] = useState(null)

  // Groupe + trie les séances par espace (Secondes / Premières-Terminales), en traitant
  // toute séance sans niveauScolaire (créée avant cette fonctionnalité) comme "seconde".
  const seancesParGroupe = useMemo(() => {
    const groupes = { seconde: [], premiere_terminale: [] }
    seances.forEach((s) => {
      const g = s.niveauScolaire === 'premiere_terminale' ? 'premiere_terminale' : 'seconde'
      groupes[g].push(s)
    })
    Object.keys(groupes).forEach((g) => groupes[g].sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0)))
    return groupes
  }, [seances])

  function importerSeancesTypes() {
    const dejaImportees = new Set(seances.map((s) => s.codeType).filter(Boolean))
    const nouvelles = genererSeancesTypesSecondes().filter((s) => !dejaImportees.has(s.codeType))
    if (nouvelles.length === 0) return
    const maxOrdre = seances.reduce((acc, s) => Math.max(acc, s.ordre ?? 0), 0)
    const avecOrdre = nouvelles.map((s, i) => ({ ...s, ordre: maxOrdre + 1 + i }))
    setSeances([...seances, ...avecOrdre])
  }

  function deplacerSeance(idDeplacee, groupeCible, idCible) {
    if (idDeplacee === idCible) return
    const groupes = {
      seconde: [...seancesParGroupe.seconde],
      premiere_terminale: [...seancesParGroupe.premiere_terminale]
    }
    let seanceDeplacee = null
    Object.keys(groupes).forEach((g) => {
      const idx = groupes[g].findIndex((s) => s.id === idDeplacee)
      if (idx !== -1) [seanceDeplacee] = groupes[g].splice(idx, 1)
    })
    if (!seanceDeplacee) return
    seanceDeplacee = { ...seanceDeplacee, niveauScolaire: groupeCible }
    const cible = groupes[groupeCible]
    const idxCible = idCible ? cible.findIndex((s) => s.id === idCible) : cible.length
    cible.splice(idxCible === -1 ? cible.length : idxCible, 0, seanceDeplacee)
    const toutesReordonnees = [
      ...groupes.seconde.map((s, i) => ({ ...s, ordre: i })),
      ...groupes.premiere_terminale.map((s, i) => ({ ...s, ordre: i }))
    ]
    setSeances(toutesReordonnees)
    setDraggedId(null)
  }


  // Une mise à jour cloud (nouvel élève connecté, PIN défini, séance réalisée sur un autre
  // appareil...) doit rafraîchir les listes dérivées du roster local, qui viennent d'être
  // mises à jour par storage.demarrerSynchroCloud juste avant cet appel.
  useEffect(() => {
    if (cloudTick !== undefined) setRosterVersion((v) => v + 1)
  }, [cloudTick])

  const classes = useMemo(() => {
    const depuisRoster = storage.getClasses()
    const depuisRealisations = Array.from(new Set(realisations.map((r) => r.eleve.classe)))
    return Array.from(new Set([...depuisRoster, ...depuisRealisations])).sort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realisations, rosterVersion])

  const classeActive = classeSelectionnee !== null ? classeSelectionnee : classes.length > 0 ? classes[0] : null

  const elevesDeLaClasse = useMemo(() => {
    if (classeActive === null) return []
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return storage.getElevesClasse(classeActive)
  }, [classeActive, rosterVersion])

  const realisationsParEleveId = useMemo(() => {
    const map = {}
    realisations.forEach((r) => {
      const cle = r.eleve.id || `${r.eleve.nom}__${r.eleve.prenom}__${r.eleve.classe}`
      if (!map[cle]) map[cle] = []
      map[cle].push(r)
    })
    return map
  }, [realisations])

  // Élèves de la classe (roster) + élèves "orphelins" présents seulement dans les réalisations (ancien format)
  const lignesEleves = useMemo(() => {
    if (classeActive === null) return []
    const lignes = elevesDeLaClasse.map((e) => ({
      id: e.id,
      nom: e.nom,
      prenom: e.prenom,
      sexe: e.sexe || null,
      classeOrigine: e.classeOrigine || null,
      pinDefini: !!e.pin,
      realisations: realisationsParEleveId[e.id] || []
    }))
    realisations
      .filter((r) => r.eleve.classe === classeActive && !r.eleve.id)
      .forEach((r) => {
        const cle = `${r.eleve.nom}__${r.eleve.prenom}__${r.eleve.classe}`
        if (!lignes.some((l) => `${l.nom}__${l.prenom}__${classeActive}` === cle)) {
          lignes.push({
            id: null,
            nom: r.eleve.nom,
            prenom: r.eleve.prenom,
            pinDefini: false,
            realisations: realisationsParEleveId[cle] || []
          })
        }
      })
    return lignes.sort((a, b) => (a.classeOrigine || '').localeCompare(b.classeOrigine || '', 'fr') || a.nom.localeCompare(b.nom, 'fr'))
  }, [classeActive, elevesDeLaClasse, realisations, realisationsParEleveId])

  function enregistrerSeance(seance) {
    const existe = seances.some((s) => s.id === seance.id)
    setSeances(existe ? seances.map((s) => (s.id === seance.id ? seance : s)) : [...seances, seance])
    setEditeurOuvert(false)
    setSeanceEnEdition(null)
  }

  function ouvrirEditionSeance(seance) {
    setSeanceEnEdition(seance)
    setEditeurOuvert(true)
  }

  function ouvrirNouvelleSeance() {
    setSeanceEnEdition(null)
    setEditeurOuvert(true)
  }

  function validerVisibilite(classesSelectionnees) {
    setSeances(
      seances.map((sv) =>
        sv.id === seancePourVisibilite.id
          ? { ...sv, classesVisibles: classesSelectionnees, visible: classesSelectionnees.length > 0 }
          : sv
      )
    )
    setSeancePourVisibilite(null)
  }

  function validerVisibiliteTest(classesSelectionnees) {
    storage.setTestVisibilite(testPourVisibilite.id, classesSelectionnees)
    setTestPourVisibilite(null)
    setRosterVersion((v) => v + 1)
  }

  function supprimerSeance(id) {
    setSeances(seances.filter((s) => s.id !== id))
  }

  function supprimerEleve(eleveId) {
    if (!eleveId || classeActive === null) return
    if (!confirm('Supprimer cet élève de la classe ? Son historique de séances est conservé.')) return
    storage.supprimerEleve(classeActive, eleveId)
    setEleveFicheOuverte(null)
    setRosterVersion((v) => v + 1)
  }

  function supprimerClasseActive() {
    if (classeActive === null) return
    if (!confirm(`Supprimer entièrement la classe ${classeActive} et tous ses élèves ? L'historique de leurs séances est conservé.`)) return
    storage.supprimerClasse(classeActive)
    setClasseSelectionnee(null)
    setEleveFicheOuverte(null)
    setRosterVersion((v) => v + 1)
  }

  function supprimerSeancesEleve(eleve) {
    if (!onSupprimerRealisationsEleve || classeActive === null) return
    if (!confirm(`Effacer toutes les séances enregistrées de ${eleve.prenom} ${eleve.nom} ? Cette action est irréversible.`)) return
    onSupprimerRealisationsEleve(eleve.id, eleve.nom, eleve.prenom, classeActive)
  }

  function supprimerSeancesClasse() {
    if (!onSupprimerRealisationsClasse || classeActive === null) return
    if (!confirm(`Effacer toutes les séances enregistrées de toute la classe ${classeActive} ? Cette action est irréversible.`)) return
    onSupprimerRealisationsClasse(classeActive)
  }

  function ajouterEleve(e) {
    e.preventDefault()
    if (!nouvelEleveNom.trim() || !nouvelElevePrenom.trim() || classeActive === null) return
    storage.ajouterEleveManuel(classeActive, nouvelEleveNom, nouvelElevePrenom, nouvelEleveSexe || null)
    setNouvelEleveNom('')
    setNouvelElevePrenom('')
    setNouvelEleveSexe('')
    setAjoutEleveOuvert(false)
    setRosterVersion((v) => v + 1)
  }

  function creerClasse(e) {
    e.preventDefault()
    if (!nouvelleClasseNom.trim()) return
    const nom = storage.ajouterClasse(nouvelleClasseNom)
    setNouvelleClasseNom('')
    setNouvelleClasseOuverte(false)
    setClasseSelectionnee(nom)
    setRosterVersion((v) => v + 1)
  }

  function exporterCSV() {
    const cible = classeActive !== null ? realisations.filter((r) => r.eleve.classe === classeActive) : realisations
    const lignes = [[
      'Classe', 'Nom', 'Prénom', 'Séance', 'Niveau', 'Date', 'Blocs réussis', 'Borg',
      'Allure %', 'Distance/durée %', 'Note déclarée', 'Note réelle', 'Source',
      'Ajustement comportement', 'Remarque comportement', 'Note finale', 'Observation'
    ]]
    cible.forEach((r) => {
      const nbReussis = r.blocsResultats.filter((b) => b.reussite === 'reussi').length
      const pct = pourcentagesReussite(r.blocsResultats)
      lignes.push([
        r.eleve.classe,
        r.eleve.nom,
        r.eleve.prenom,
        r.seanceTitre,
        r.niveauNom,
        new Date(r.date).toLocaleDateString('fr-FR'),
        `${nbReussis}/${r.blocsResultats.length}`,
        r.borg,
        pct.allure ?? '',
        pct.distanceDuree ?? '',
        r.note,
        r.noteReelle ?? r.note,
        r.noteReelleAvecGps === undefined ? '' : r.noteReelleAvecGps ? 'avec GPS' : 'sans GPS',
        r.ajustementComportement || 0,
        r.commentaireComportement || '',
        noteFinale(r),
        r.observationGenerale || ''
      ])
    })
    const csv = lignes.map((l) => l.join(';')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `course-duree-pro_${classeActive !== null ? (classeActive || 'sans-nom') : 'toutes'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-2xl text-piste-900">Espace enseignant</h2>
      </div>

      {storage.cloudDisponible() && storage.getCodeSync() && (
        <div className="flex items-center gap-1.5 mb-4 text-[11px] text-piste-500">
          <span className="w-1.5 h-1.5 rounded-full bg-piste-500" />
          Synchronisation active — code « {storage.getCodeSync()} » (partage-le via le flashcode)
        </div>
      )}

      <div className="flex gap-1.5 mb-6 bg-piste-50 rounded-full p-1 w-fit">
        {[
          { id: 'seances', label: 'Séances' },
          { id: 'tests', label: 'Tests' },
          { id: 'suivi', label: 'Élèves & suivi' },
          { id: 'vma', label: 'VMA' }
        ].map((o) => (
          <button
            key={o.id}
            onClick={() => setOnglet(o.id)}
            className={`text-sm font-medium px-4 py-1.5 rounded-full transition ${onglet === o.id ? 'bg-piste-800 text-white' : 'text-piste-600'}`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {onglet === 'seances' && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold tracking-wide text-piste-500 uppercase">Bibliothèque de séances</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={importerSeancesTypes}
                className="flex items-center gap-1.5 text-xs font-medium text-piste-700 hover:text-piste-900"
              >
                <Sparkles size={14} /> Importer les séances types
              </button>
              <button
                onClick={ouvrirNouvelleSeance}
                className="flex items-center gap-1.5 bg-piste-800 hover:bg-piste-700 text-white text-sm font-medium px-3.5 py-2 rounded-full transition"
              >
                <Plus size={16} /> Séance
              </button>
            </div>
          </div>

          {seances.length === 0 && <p className="text-sm text-piste-500">Aucune séance créée pour l'instant.</p>}

          {GROUPES_SCOLAIRES.map((groupe) => (
            <div key={groupe.id} className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <p className="text-[11px] font-semibold tracking-wide text-piste-400 uppercase">{groupe.label}</p>
                <div className="h-px flex-1 bg-piste-100" />
              </div>
              <div
                className="space-y-2 min-h-[8px]"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  if (draggedId) deplacerSeance(draggedId, groupe.id, null)
                }}
              >
                {seancesParGroupe[groupe.id].length === 0 && (
                  <p className="text-xs text-piste-400 italic px-1">Glisse une séance ici, ou importe les séances types.</p>
                )}
                {seancesParGroupe[groupe.id].map((s) => {
                  const nbClassesVisibles = Array.isArray(s.classesVisibles) ? s.classesVisibles.length : s.visible ? classes.length : 0
                  const nbNiveauxVisibles = s.niveaux.filter((n) => n.visible !== false).length
                  return (
                    <div
                      key={s.id}
                      draggable
                      onDragStart={() => setDraggedId(s.id)}
                      onDragEnd={() => setDraggedId(null)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        if (draggedId) deplacerSeance(draggedId, groupe.id, s.id)
                      }}
                      onClick={() => ouvrirEditionSeance(s)}
                      className={`flex items-center justify-between bg-white border rounded-xl px-3 py-3 cursor-pointer hover:border-piste-300 transition ${draggedId === s.id ? 'opacity-40 border-piste-300' : 'border-piste-100'}`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-piste-300 shrink-0 cursor-grab" title="Glisser pour réorganiser">
                          <GripVertical size={16} />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-piste-900 truncate">{s.titre}</p>
                          <p className="text-xs text-piste-500">{nbNiveauxVisibles}/{s.niveaux.length} niveaux visibles · Voir le détail</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setSeancePourVisibilite(s)
                          }}
                          className={`text-[11px] font-medium px-2.5 py-1.5 rounded-full border transition ${nbClassesVisibles > 0 ? 'bg-piste-800 text-white border-piste-800' : 'border-piste-200 text-piste-700'}`}
                        >
                          {nbClassesVisibles > 0 ? `Visible (${nbClassesVisibles})` : 'Masquée'}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            supprimerSeance(s.id)
                          }}
                          className="p-1.5 rounded-full hover:bg-[#fbeeea] text-alerte"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </section>
      )}

      {onglet === 'tests' && (
        <section>
          <h3 className="text-xs font-semibold tracking-wide text-piste-500 uppercase mb-3">
            Tests VMA et évaluation Fartlek
          </h3>
          <p className="text-xs text-piste-500 mb-4">
            Rends un test visible pour que les élèves d'une classe sachent à l'avance ce qu'ils vont
            réaliser (objectif, déroulement, niveaux). Le test reste accessible depuis leurs Outils
            quoi qu'il arrive ; la notation ne leur est jamais montrée.
          </p>
          <div className="space-y-2">
            {TESTS_CATALOGUE.map((t) => {
              const v = storage.getTestsVisibilite()[t.id]
              const nbClassesVisibles = Array.isArray(v?.classesVisibles) ? v.classesVisibles.length : 0
              return (
                <div key={t.id} className="flex items-center justify-between bg-white border border-piste-100 rounded-xl px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-piste-900 truncate">{t.titre}</p>
                    <p className="text-xs text-piste-500 truncate">{t.objectif}</p>
                  </div>
                  <button
                    onClick={() => setTestPourVisibilite(t)}
                    className={`shrink-0 text-[11px] font-medium px-2.5 py-1.5 rounded-full border transition ${nbClassesVisibles > 0 ? 'bg-piste-800 text-white border-piste-800' : 'border-piste-200 text-piste-700'}`}
                  >
                    {nbClassesVisibles > 0 ? `Visible (${nbClassesVisibles})` : 'Masqué'}
                  </button>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {onglet === 'suivi' && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold tracking-wide text-piste-500 uppercase">Classes</h3>
            <div className="flex items-center gap-3">
              <button onClick={() => setNouvelleClasseOuverte((v) => !v)} className="flex items-center gap-1.5 text-xs font-medium text-piste-700 hover:text-piste-900">
                <FolderPlus size={14} /> Nouvelle classe
              </button>
              <button onClick={() => setImportOuvert(true)} className="flex items-center gap-1.5 text-xs font-medium text-piste-700 hover:text-piste-900">
                <Upload size={14} /> Importer des élèves
              </button>
              <button onClick={exporterCSV} className="flex items-center gap-1.5 text-xs font-medium text-piste-700 hover:text-piste-900">
                <Download size={14} /> Exporter CSV
              </button>
              {classeActive !== null && (
                <>
                  {lignesEleves.some((l) => l.realisations.length > 0) && (
                    <button onClick={supprimerSeancesClasse} className="flex items-center gap-1.5 text-xs font-medium text-alerte hover:text-alerte/80">
                      <Trash2 size={14} /> Effacer les séances de la classe
                    </button>
                  )}
                  <button onClick={supprimerClasseActive} className="flex items-center gap-1.5 text-xs font-medium text-alerte hover:text-alerte/80">
                    <FolderX size={14} /> Supprimer la classe
                  </button>
                </>
              )}
            </div>
          </div>

          {nouvelleClasseOuverte && (
            <form onSubmit={creerClasse} className="flex items-center gap-2 mb-4">
              <input
                value={nouvelleClasseNom}
                onChange={(e) => setNouvelleClasseNom(e.target.value)}
                placeholder="Ex : 2NDE7"
                autoFocus
                className="flex-1 rounded-xl border border-piste-200 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-piste-500"
              />
              <button type="submit" className="bg-piste-800 hover:bg-piste-700 text-white text-sm font-medium px-3.5 py-2 rounded-xl transition">
                Créer
              </button>
            </form>
          )}

          {classes.length === 0 ? (
            <p className="text-sm text-piste-500">Aucune classe pour l'instant. Importe une liste d'élèves ou crée une classe pour commencer.</p>
          ) : (
            <>
              <div className="flex gap-2 overflow-x-auto mb-4 pb-1">
                {classes.map((c) => (
                  <button
                    key={c}
                    onClick={() => {
                      setClasseSelectionnee(c)
                      setEleveFicheOuverte(null)
                      setAjoutEleveOuvert(false)
                    }}
                    className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border transition ${classeActive === c ? 'bg-piste-800 text-white border-piste-800' : 'border-piste-200 text-piste-600'}`}
                  >
                    {c || '(sans nom)'}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-piste-500">{lignesEleves.length} élève{lignesEleves.length > 1 ? 's' : ''}</p>
                <button
                  onClick={() => setAjoutEleveOuvert((v) => !v)}
                  className="flex items-center gap-1.5 text-xs font-medium text-piste-700 hover:text-piste-900"
                >
                  <UserPlus size={14} /> Ajouter un élève
                </button>
              </div>

              {ajoutEleveOuvert && (
                <form onSubmit={ajouterEleve} className="flex flex-col sm:flex-row gap-2 mb-4 bg-piste-50 rounded-xl p-3">
                  <input
                    value={nouvelElevePrenom}
                    onChange={(e) => setNouvelElevePrenom(e.target.value)}
                    placeholder="Prénom"
                    autoFocus
                    className="flex-1 rounded-xl border border-piste-200 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-piste-500"
                  />
                  <input
                    value={nouvelEleveNom}
                    onChange={(e) => setNouvelEleveNom(e.target.value)}
                    placeholder="Nom"
                    className="flex-1 rounded-xl border border-piste-200 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-piste-500"
                  />
                  <select
                    value={nouvelEleveSexe}
                    onChange={(e) => setNouvelEleveSexe(e.target.value)}
                    className="rounded-xl border border-piste-200 px-2.5 py-2 text-sm bg-white"
                  >
                    <option value="">Sexe</option>
                    <option value="F">F</option>
                    <option value="M">M</option>
                  </select>
                  <button type="submit" className="bg-piste-800 hover:bg-piste-700 text-white text-sm font-medium px-3.5 py-2 rounded-xl transition">
                    Ajouter
                  </button>
                </form>
              )}

              {lignesEleves.length === 0 && <p className="text-sm text-piste-500">Aucun élève dans cette classe.</p>}

              <div className="space-y-2">
                {lignesEleves.map((eleve) => {
                  const cle = eleve.id || `${eleve.nom}__${eleve.prenom}`
                  const detailVma = eleve.id ? storage.getVmaDetail({ id: eleve.id, nom: eleve.nom, prenom: eleve.prenom, classe: classeActive }) : null
                  const vmaRetenue = detailVma ? detailVma.manuelle ?? detailVma.auto ?? null : null
                  const vmaImposee = detailVma && detailVma.manuelle != null
                  return (
                    <button
                      key={cle}
                      onClick={() => setEleveFicheOuverte(cle)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-piste-50 rounded-xl hover:bg-piste-100 transition text-left"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-piste-900 truncate">
                          {eleve.prenom} {eleve.nom}
                          {eleve.sexe && <span className="text-piste-400 font-normal"> ({eleve.sexe})</span>}
                        </p>
                        <p className="text-xs text-piste-500 truncate">
                          {eleve.classeOrigine && eleve.classeOrigine !== classeActive && (
                            <span className="text-piste-600 font-medium">{eleve.classeOrigine} · </span>
                          )}
                          {vmaImposee
                            ? 'VMA imposée par le prof'
                            : detailVma?.autoTest
                            ? `${LABEL_TEST[detailVma.autoTest] || detailVma.autoTest} · ${formatDateVma(detailVma.autoDate)}`
                            : 'Aucun test VMA'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 pl-2">
                        <span className="font-display text-lg text-piste-900">{vmaRetenue ? `${vmaRetenue} km/h` : '—'}</span>
                        <ChevronRight size={16} className="text-piste-400" />
                      </div>
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {eleveFicheOuverte !== null && (() => {
            const eleveFiche = lignesEleves.find((e) => (e.id || `${e.nom}__${e.prenom}`) === eleveFicheOuverte)
            if (!eleveFiche) return null
            return (
              <FicheSuiviEleve
                key={eleveFicheOuverte}
                eleve={{ ...eleveFiche, classe: classeActive }}
                realisations={eleveFiche.realisations}
                listeEleves={lignesEleves}
                onNaviguer={(cle) => setEleveFicheOuverte(cle)}
                onFermer={() => setEleveFicheOuverte(null)}
                onChange={() => setRosterVersion((v) => v + 1)}
                onSupprimerEleve={supprimerEleve}
                onSupprimerSeancesEleve={supprimerSeancesEleve}
                onModifierRealisation={onModifierRealisation}
                onSupprimerRealisation={onSupprimerRealisation}
              />
            )
          })()}
        </section>
      )}

      {onglet === 'vma' && (
        <section>
          <h3 className="text-xs font-semibold tracking-wide text-piste-500 uppercase mb-3">
            VMA des élèves — retour de la séance test
          </h3>
          {classes.length === 0 ? (
            <p className="text-sm text-piste-500">Aucune classe pour l'instant.</p>
          ) : (
            <>
              <div className="flex gap-2 overflow-x-auto mb-4 pb-1">
                {classes.map((c) => (
                  <button
                    key={c}
                    onClick={() => setClasseSelectionnee(c)}
                    className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border transition ${classeActive === c ? 'bg-piste-800 text-white border-piste-800' : 'border-piste-200 text-piste-600'}`}
                  >
                    {c || '(sans nom)'}
                  </button>
                ))}
              </div>
              {elevesDeLaClasse.length === 0 && <p className="text-sm text-piste-500">Aucun élève dans cette classe.</p>}
              <div className="space-y-2">
                {elevesDeLaClasse.map((e) => (
                  <VmaEleveLigne
                    key={e.id}
                    eleve={{ ...e, classe: classeActive }}
                    onChange={() => setRosterVersion((v) => v + 1)}
                  />
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {seancePourVisibilite && (
        <VisibiliteClasses
          seance={seancePourVisibilite}
          classesDisponibles={classes}
          onValider={validerVisibilite}
          onFermer={() => setSeancePourVisibilite(null)}
        />
      )}

      {testPourVisibilite && (
        <VisibiliteClasses
          seance={{
            titre: testPourVisibilite.titre,
            classesVisibles: storage.getTestsVisibilite()[testPourVisibilite.id]?.classesVisibles || []
          }}
          classesDisponibles={classes}
          onValider={validerVisibiliteTest}
          onFermer={() => setTestPourVisibilite(null)}
        />
      )}

      {editeurOuvert && (
        <SeanceEditor
          seanceInitiale={seanceEnEdition}
          onEnregistrer={enregistrerSeance}
          onFermer={() => {
            setEditeurOuvert(false)
            setSeanceEnEdition(null)
          }}
        />
      )}
      {importOuvert && (
        <ImportEleves
          onImporte={() => {
            setImportOuvert(false)
            setRosterVersion((v) => v + 1)
          }}
          onFermer={() => setImportOuvert(false)}
        />
      )}
    </div>
  )
}
