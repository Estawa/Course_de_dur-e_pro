import { useMemo, useState } from 'react'
import { Download, Plus, Trash2, Upload, ChevronDown, ChevronUp, KeyRound, UserX, Pencil, UserPlus, FolderPlus, FolderX, Check, X } from 'lucide-react'
import SeanceEditor from './SeanceEditor'
import ImportEleves from './ImportEleves'
import VmaEleveLigne from './VmaEleveLigne'
import ComportementAjustement from './ComportementAjustement'
import VisibiliteClasses from './VisibiliteClasses'
import { storage } from '../utils/storage'
import { syntheseCycle, noteFinale, pourcentagesReussite } from '../utils/calc'

export default function EnseignantDashboard({ seances, setSeances, realisations, onModifierRealisation }) {
  const [onglet, setOnglet] = useState('seances') // seances | suivi | vma
  const [editeurOuvert, setEditeurOuvert] = useState(false)
  const [seanceEnEdition, setSeanceEnEdition] = useState(null)
  const [seancePourVisibilite, setSeancePourVisibilite] = useState(null)
  const [importOuvert, setImportOuvert] = useState(false)
  const [rosterVersion, setRosterVersion] = useState(0) // force refresh après import/suppression
  const [classeSelectionnee, setClasseSelectionnee] = useState(null)
  const [eleveOuvert, setEleveOuvert] = useState(null)
  const [eleveEnEdition, setEleveEnEdition] = useState(null) // id de l'élève en cours d'édition
  const [editNom, setEditNom] = useState('')
  const [editPrenom, setEditPrenom] = useState('')
  const [editSexe, setEditSexe] = useState('')
  const [ajoutEleveOuvert, setAjoutEleveOuvert] = useState(false)
  const [nouvelEleveNom, setNouvelEleveNom] = useState('')
  const [nouvelElevePrenom, setNouvelElevePrenom] = useState('')
  const [nouvelEleveSexe, setNouvelEleveSexe] = useState('')
  const [nouvelleClasseOuverte, setNouvelleClasseOuverte] = useState(false)
  const [nouvelleClasseNom, setNouvelleClasseNom] = useState('')

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
    return lignes.sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
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

  function supprimerSeance(id) {
    setSeances(seances.filter((s) => s.id !== id))
  }

  function supprimerEleve(eleveId) {
    if (!eleveId || classeActive === null) return
    if (!confirm('Supprimer cet élève de la classe ? Son historique de séances est conservé.')) return
    storage.supprimerEleve(classeActive, eleveId)
    setRosterVersion((v) => v + 1)
  }

  function supprimerClasseActive() {
    if (classeActive === null) return
    if (!confirm(`Supprimer entièrement la classe ${classeActive} et tous ses élèves ? L'historique de leurs séances est conservé.`)) return
    storage.supprimerClasse(classeActive)
    setClasseSelectionnee(null)
    setEleveOuvert(null)
    setRosterVersion((v) => v + 1)
  }

  function reinitialiserPin(eleveId) {
    if (!eleveId || classeActive === null) return
    storage.reinitialiserPin(classeActive, eleveId)
    setRosterVersion((v) => v + 1)
  }

  function ouvrirEdition(eleve) {
    setEleveEnEdition(eleve.id)
    setEditNom(eleve.nom)
    setEditPrenom(eleve.prenom)
    setEditSexe(eleve.sexe || '')
  }

  function enregistrerEdition(eleveId) {
    if (!editNom.trim() || !editPrenom.trim() || classeActive === null) return
    storage.modifierEleve(classeActive, eleveId, { nom: editNom, prenom: editPrenom, sexe: editSexe })
    setEleveEnEdition(null)
    setRosterVersion((v) => v + 1)
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

      <div className="flex gap-1.5 mb-6 bg-piste-50 rounded-full p-1 w-fit">
        {[
          { id: 'seances', label: 'Séances' },
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
            <button
              onClick={ouvrirNouvelleSeance}
              className="flex items-center gap-1.5 bg-piste-800 hover:bg-piste-700 text-white text-sm font-medium px-3.5 py-2 rounded-full transition"
            >
              <Plus size={16} /> Séance
            </button>
          </div>
          {seances.length === 0 && <p className="text-sm text-piste-500">Aucune séance créée pour l'instant.</p>}
          <div className="space-y-2">
            {seances.map((s) => {
              const nbClassesVisibles = Array.isArray(s.classesVisibles) ? s.classesVisibles.length : s.visible ? classes.length : 0
              const nbNiveauxVisibles = s.niveaux.filter((n) => n.visible !== false).length
              return (
                <div
                  key={s.id}
                  onClick={() => ouvrirEditionSeance(s)}
                  className="flex items-center justify-between bg-white border border-piste-100 rounded-xl px-4 py-3 cursor-pointer hover:border-piste-300 transition"
                >
                  <div>
                    <p className="text-sm font-medium text-piste-900">{s.titre}</p>
                    <p className="text-xs text-piste-500">{nbNiveauxVisibles}/{s.niveaux.length} niveaux visibles · Voir le détail</p>
                  </div>
                  <div className="flex items-center gap-1">
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
                <button onClick={supprimerClasseActive} className="flex items-center gap-1.5 text-xs font-medium text-alerte hover:text-alerte/80">
                  <FolderX size={14} /> Supprimer la classe
                </button>
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
                      setEleveOuvert(null)
                      setEleveEnEdition(null)
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
                  const synth = syntheseCycle(eleve.realisations)
                  const ouvert = eleveOuvert === (eleve.id || `${eleve.nom}__${eleve.prenom}`)
                  return (
                    <div key={eleve.id || `${eleve.nom}__${eleve.prenom}`} className="bg-piste-50 rounded-xl overflow-hidden">
                      <button
                        onClick={() => setEleveOuvert(ouvert ? null : eleve.id || `${eleve.nom}__${eleve.prenom}`)}
                        className="w-full flex items-center justify-between px-4 py-3"
                      >
                        <div className="text-left">
                          <p className="text-sm font-medium text-piste-900">
                            {eleve.prenom} {eleve.nom}
                            {eleve.sexe && <span className="text-piste-400 font-normal"> ({eleve.sexe})</span>}
                          </p>
                          <p className="text-xs text-piste-500">
                            {synth ? `${synth.nbSeances} séance${synth.nbSeances > 1 ? 's' : ''}` : 'Aucune séance'}
                            {eleve.id && !eleve.pinDefini && ' · PIN non défini'}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          {synth && <span className="font-display text-lg text-piste-900">{synth.moyenne}/20</span>}
                          {ouvert ? <ChevronUp size={18} className="text-piste-500" /> : <ChevronDown size={18} className="text-piste-500" />}
                        </div>
                      </button>

                      {ouvert && (
                        <div className="px-4 pb-4 space-y-2">
                          {eleve.id && eleveEnEdition === eleve.id && (
                            <form
                              onSubmit={(e) => {
                                e.preventDefault()
                                enregistrerEdition(eleve.id)
                              }}
                              className="flex flex-col sm:flex-row gap-2 mb-2"
                            >
                              <input
                                value={editPrenom}
                                onChange={(e) => setEditPrenom(e.target.value)}
                                autoFocus
                                className="flex-1 rounded-lg border border-piste-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-piste-500"
                              />
                              <input
                                value={editNom}
                                onChange={(e) => setEditNom(e.target.value)}
                                className="flex-1 rounded-lg border border-piste-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-piste-500"
                              />
                              <select
                                value={editSexe}
                                onChange={(e) => setEditSexe(e.target.value)}
                                className="rounded-lg border border-piste-200 px-2 py-1.5 text-sm bg-white"
                              >
                                <option value="">Sexe</option>
                                <option value="F">F</option>
                                <option value="M">M</option>
                              </select>
                              <div className="flex gap-1.5">
                                <button type="submit" className="p-1.5 rounded-full bg-piste-800 text-white hover:bg-piste-700">
                                  <Check size={14} />
                                </button>
                                <button type="button" onClick={() => setEleveEnEdition(null)} className="p-1.5 rounded-full border border-piste-200 text-piste-600 hover:bg-piste-50">
                                  <X size={14} />
                                </button>
                              </div>
                            </form>
                          )}
                          {eleve.id && (
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <button
                                onClick={() => ouvrirEdition(eleve)}
                                className="flex items-center gap-1 text-[11px] font-medium text-piste-700 border border-piste-200 rounded-full px-2.5 py-1 hover:bg-white"
                              >
                                <Pencil size={12} /> Modifier nom/prénom
                              </button>
                              <button
                                onClick={() => reinitialiserPin(eleve.id)}
                                className="flex items-center gap-1 text-[11px] font-medium text-piste-700 border border-piste-200 rounded-full px-2.5 py-1 hover:bg-white"
                              >
                                <KeyRound size={12} /> Réinitialiser le PIN
                              </button>
                              <button
                                onClick={() => supprimerEleve(eleve.id)}
                                className="flex items-center gap-1 text-[11px] font-medium text-alerte border border-[#f0d3ca] rounded-full px-2.5 py-1 hover:bg-white"
                              >
                                <UserX size={12} /> Retirer de la classe
                              </button>
                            </div>
                          )}
                          {eleve.realisations.length === 0 && <p className="text-xs text-piste-500">Pas encore de séance réalisée.</p>}
                          {eleve.realisations
                            .slice()
                            .sort((a, b) => b.date - a.date)
                            .map((r) => {
                              const nbReussis = r.blocsResultats?.filter((b) => b.reussite === 'reussi').length ?? 0
                              const noteBase = r.noteReelle ?? r.note
                              const noteAvecComportement = noteFinale(r)
                              const ajustement = r.ajustementComportement || 0
                              const labelGps = r.noteReelleAvecGps === undefined ? null : r.noteReelleAvecGps ? '(ac GPS)' : '(Sans GPS)'
                              const pct = pourcentagesReussite(r.blocsResultats)
                              return (
                                <div key={r.id} className="bg-white rounded-lg px-3 py-2.5">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="text-xs font-medium text-piste-900">{r.seanceTitre} · {r.niveauNom}</p>
                                      <p className="text-[11px] text-piste-500">
                                        {new Date(r.date).toLocaleDateString('fr-FR')} · {nbReussis}/{r.blocsResultats?.length ?? 0} blocs · Borg {r.borg}
                                      </p>
                                      {pct.allure !== null && (
                                        <p className="text-[11px] text-piste-500">
                                          Allure {pct.allure}% · Distance/durée {pct.distanceDuree}%
                                        </p>
                                      )}
                                    </div>
                                    <div className="text-right">
                                      <span className="font-display text-piste-900">{noteAvecComportement}/20</span>
                                      {ajustement !== 0 && (
                                        <p className="text-[10px] text-piste-500">{noteBase}/20 base {ajustement > 0 ? '+' : ''}{ajustement}</p>
                                      )}
                                      {labelGps && <p className="text-[10px] text-piste-500">{labelGps}</p>}
                                    </div>
                                  </div>
                                  {onModifierRealisation && (
                                    <ComportementAjustement realisation={r} onModifier={onModifierRealisation} />
                                  )}
                                </div>
                              )
                            })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}
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
