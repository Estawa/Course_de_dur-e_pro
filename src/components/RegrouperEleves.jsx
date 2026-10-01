import { useMemo, useState } from 'react'
import { X, ArrowRightLeft, Search, CheckCircle2, AlertTriangle } from 'lucide-react'
import { storage } from '../utils/storage'
import { normaliser } from '../utils/eleves'
import { libelleNiveau } from '../utils/niveauLabels'
import { LABEL_TEST } from './VmaEleveLigne'

const NOUVEAU = '__nouveau__'
const dateFr = (ts) => (ts ? new Date(ts).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '')
const cleSource = (e) => e.id || `${e.nom}__${e.prenom}__${e.classe}`

// Regroupe des séances réalisées / tests VMA / Fartlek d'élèves "sources" (par défaut ceux qui
// s'appellent "test") sous un seul élève cible (par défaut C. Guilhem, classe PROF, créé au
// besoin). Chaque élément est déplacé, pas copié.
export default function RegrouperEleves({ realisations, onFermer, onTermine }) {
  const roster = storage.getRoster()

  // Tous les élèves connus : roster (toutes classes) + élèves présents seulement dans les réalisations
  const tousEleves = useMemo(() => {
    const liste = []
    Object.entries(roster || {}).forEach(([classe, eleves]) => eleves.forEach((e) => liste.push({ ...e, classe })))
    realisations.forEach((r) => {
      if (r.eleve.id) return
      const e = { id: null, nom: r.eleve.nom, prenom: r.eleve.prenom, classe: r.eleve.classe }
      if (!liste.some((l) => !l.id && cleSource(l) === cleSource(e))) liste.push(e)
    })
    return liste
  }, [roster, realisations])

  // --- Cible ---
  const classes = storage.getClasses()
  const [classeCible, setClasseCible] = useState(() => (classes.includes('PROF') ? 'PROF' : NOUVEAU))
  const [nouvelleClasse, setNouvelleClasse] = useState('PROF')
  const elevesClasseCible = classeCible === NOUVEAU ? [] : storage.getElevesClasse(classeCible)
  const [eleveCibleId, setEleveCibleId] = useState(() => {
    if (!classes.includes('PROF')) return NOUVEAU
    const g = storage.getElevesClasse('PROF').find((e) => normaliser(`${e.prenom} ${e.nom}`).includes('guilhem'))
    return g ? g.id : NOUVEAU
  })
  const [nouveauNom, setNouveauNom] = useState('Guilhem')
  const [nouveauPrenom, setNouveauPrenom] = useState('C.')

  function changerClasseCible(c) {
    setClasseCible(c)
    if (c === NOUVEAU) return setEleveCibleId(NOUVEAU)
    const g = storage.getElevesClasse(c).find((e) => normaliser(`${e.prenom} ${e.nom}`).includes('guilhem'))
    setEleveCibleId(g ? g.id : NOUVEAU)
  }

  // --- Sources ---
  const [recherche, setRecherche] = useState('test')
  const correspondants = useMemo(() => {
    const q = normaliser(recherche)
    if (!q) return []
    return tousEleves
      .filter((e) => normaliser(e.nom).includes(q) || normaliser(e.prenom).includes(q))
      .filter((e) => !(eleveCibleId !== NOUVEAU && e.id === eleveCibleId))
  }, [recherche, tousEleves, eleveCibleId])
  const [sourcesDecochees, setSourcesDecochees] = useState(() => new Set())
  const sources = correspondants.filter((e) => !sourcesDecochees.has(cleSource(e)))

  // --- Éléments transférables des sources cochées ---
  const elements = useMemo(() => {
    const out = []
    sources.forEach((s) => {
      const k = cleSource(s)
      const nomSource = `${s.prenom} ${s.nom} (${s.classe || 'sans classe'})`
      realisations
        .filter((r) => (s.id ? r.eleve.id === s.id : !r.eleve.id && cleSource(r.eleve) === k))
        .forEach((r) =>
          out.push({
            cle: `r:${r.id}`, type: 'seance', date: r.date, source: nomSource, realisationId: r.id,
            libelle: `${r.seanceTitre || 'Séance'}${r.niveauNom ? ` · ${libelleNiveau(r.niveauNom)}` : ''}`
          })
        )
      if (s.id) {
        const d = storage.getVmaDetail(s)
        ;(d.historique || []).forEach((h, i) => {
          if (h.source !== 'test') return
          out.push({
            cle: `h:${s.id}:${i}`, type: 'test', date: h.date, source: nomSource, vmaCle: s.id, index: i,
            libelle: `Test ${LABEL_TEST[h.test] || h.test} · ${h.valeur} km/h`
          })
        })
        ;(d.fartlek || []).forEach((f) =>
          out.push({
            cle: `f:${s.id}:${f.id}`, type: 'fartlek', date: f.date, source: nomSource, vmaCle: s.id, fartlekId: f.id,
            libelle: `Fartlek évaluatif${f.niveauNom ? ` · ${libelleNiveau(f.niveauNom)}` : ''}`
          })
        )
      }
    })
    return out.sort((a, b) => (b.date || 0) - (a.date || 0))
  }, [sources, realisations])
  const [elementsDecoches, setElementsDecoches] = useState(() => new Set())
  const choisis = elements.filter((e) => !elementsDecoches.has(e.cle))

  const [supprimerVides, setSupprimerVides] = useState(true)
  const [enCours, setEnCours] = useState(false)
  const [resultat, setResultat] = useState(null)

  const toggle = (setter) => (cle) =>
    setter((prev) => {
      const n = new Set(prev)
      n.has(cle) ? n.delete(cle) : n.add(cle)
      return n
    })
  const toggleSource = toggle(setSourcesDecochees)
  const toggleElement = toggle(setElementsDecoches)

  const cibleValide =
    eleveCibleId !== NOUVEAU
      ? !!eleveCibleId
      : nouveauNom.trim() && nouveauPrenom.trim() && (classeCible !== NOUVEAU || nouvelleClasse.trim())
  const eleveCibleExistant = elevesClasseCible.find((e) => e.id === eleveCibleId)
  const libelleCible =
    eleveCibleExistant
      ? `${eleveCibleExistant.prenom} ${eleveCibleExistant.nom} (${classeCible})`
      : `${nouveauPrenom.trim()} ${nouveauNom.trim()} (${(classeCible === NOUVEAU ? nouvelleClasse : classeCible).trim().toUpperCase()})`

  async function lancer() {
    if (!choisis.length || !cibleValide) return
    if (!confirm(`Transférer ${choisis.length} élément${choisis.length > 1 ? 's' : ''} vers ${libelleCible} ?`)) return
    setEnCours(true)
    const vmaSelection = {}
    choisis.forEach((e) => {
      if (!e.vmaCle) return
      vmaSelection[e.vmaCle] = vmaSelection[e.vmaCle] || { historique: [], fartlek: [] }
      if (e.type === 'test') vmaSelection[e.vmaCle].historique.push(e.index)
      if (e.type === 'fartlek') vmaSelection[e.vmaCle].fartlek.push(e.fartlekId)
    })
    try {
      const res = await storage.transfererVersEleve({
        sources,
        cible:
          eleveCibleId !== NOUVEAU
            ? { id: eleveCibleId }
            : { id: null, classe: classeCible === NOUVEAU ? nouvelleClasse : classeCible, nom: nouveauNom, prenom: nouveauPrenom },
        realisationIds: choisis.filter((e) => e.type === 'seance').map((e) => e.realisationId),
        vmaSelection,
        supprimerSourcesVides: supprimerVides
      })
      setResultat(res)
      onTermine()
    } catch (err) {
      setResultat({ erreur: err.message || String(err) })
    }
    setEnCours(false)
  }

  const champ = 'w-full rounded-xl border border-piste-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-piste-500'

  return (
    <div className="fixed inset-0 bg-black/40 z-30 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-white flex items-center justify-between px-4 py-4 border-b border-piste-100 z-10">
          <div className="flex items-center gap-2">
            <ArrowRightLeft size={18} className="text-piste-700" />
            <h3 className="font-display text-lg text-piste-900">Regrouper des séances</h3>
          </div>
          <button onClick={onFermer} className="p-1.5 text-piste-500 hover:text-piste-900" aria-label="Fermer">
            <X size={20} />
          </button>
        </div>

        {resultat ? (
          <div className="px-4 py-6 space-y-4">
            {resultat.erreur ? (
              <p className="flex items-start gap-2 text-sm text-alerte"><AlertTriangle size={16} className="shrink-0 mt-0.5" /> {resultat.erreur}</p>
            ) : (
              <>
                <p className="flex items-center gap-2 text-sm font-medium text-piste-900">
                  <CheckCircle2 size={18} className="text-piste-700" /> Transfert terminé vers {resultat.cible.prenom} {resultat.cible.nom} ({resultat.cible.classe})
                </p>
                <ul className="text-sm text-piste-700 space-y-1 pl-6 list-disc">
                  <li>{resultat.nbRealisations} séance{resultat.nbRealisations > 1 ? 's' : ''} réalisée{resultat.nbRealisations > 1 ? 's' : ''}</li>
                  <li>{resultat.nbTests} test{resultat.nbTests > 1 ? 's' : ''} VMA</li>
                  <li>{resultat.nbFartlek} Fartlek</li>
                  {resultat.nbSupprimes > 0 && <li>{resultat.nbSupprimes} compte{resultat.nbSupprimes > 1 ? 's' : ''} « test » vidé{resultat.nbSupprimes > 1 ? 's' : ''} et retiré{resultat.nbSupprimes > 1 ? 's' : ''}</li>}
                </ul>
                {!resultat.ok && (
                  <p className="text-xs text-alerte">Certaines écritures en ligne ont échoué : fais « Actualiser » pour vérifier.</p>
                )}
              </>
            )}
            <button onClick={onFermer} className="w-full bg-piste-800 hover:bg-piste-700 text-white text-sm font-medium py-2.5 rounded-xl">Fermer</button>
          </div>
        ) : (
          <div className="px-4 py-4 space-y-5">
            {/* 1. Sources */}
            <section>
              <p className="text-xs font-semibold tracking-wide text-piste-500 uppercase mb-2">1. Élèves à vider</p>
              <div className="relative mb-2">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-piste-400" />
                <input
                  value={recherche}
                  onChange={(e) => { setRecherche(e.target.value); setSourcesDecochees(new Set()); setElementsDecoches(new Set()) }}
                  placeholder="Nom ou prénom (ex : test)"
                  className={`${champ} pl-8`}
                />
              </div>
              {correspondants.length === 0 ? (
                <p className="text-sm text-piste-500">Aucun élève trouvé.</p>
              ) : (
                <div className="space-y-1.5">
                  {correspondants.map((e) => (
                    <label key={cleSource(e)} className="flex items-center gap-2.5 rounded-xl px-3 py-2 border border-piste-100 cursor-pointer">
                      <input type="checkbox" checked={!sourcesDecochees.has(cleSource(e))} onChange={() => toggleSource(cleSource(e))} className="w-4 h-4 shrink-0" />
                      <span className="text-sm text-piste-900 flex-1 truncate">{e.prenom} {e.nom}</span>
                      <span className="text-xs text-piste-500 shrink-0">{e.classe || '—'}</span>
                    </label>
                  ))}
                </div>
              )}
            </section>

            {/* 2. Éléments */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold tracking-wide text-piste-500 uppercase">2. Séances et tests à transférer</p>
                {elements.length > 0 && (
                  <button
                    onClick={() => setElementsDecoches(choisis.length === elements.length ? new Set(elements.map((e) => e.cle)) : new Set())}
                    className="text-xs font-medium text-piste-700"
                  >
                    {choisis.length === elements.length ? 'Tout décocher' : 'Tout cocher'}
                  </button>
                )}
              </div>
              {elements.length === 0 ? (
                <p className="text-sm text-piste-500">Rien à transférer pour ces élèves.</p>
              ) : (
                <div className="space-y-1.5">
                  {elements.map((e) => (
                    <label key={e.cle} className={`flex items-start gap-2.5 rounded-xl px-3 py-2 border cursor-pointer ${elementsDecoches.has(e.cle) ? 'border-piste-100' : 'border-piste-800 bg-piste-50'}`}>
                      <input type="checkbox" checked={!elementsDecoches.has(e.cle)} onChange={() => toggleElement(e.cle)} className="w-4 h-4 shrink-0 mt-0.5" />
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm text-piste-900 truncate">{e.libelle}</span>
                        <span className="block text-xs text-piste-500 truncate">{dateFr(e.date)} · {e.source}</span>
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </section>

            {/* 3. Cible */}
            <section>
              <p className="text-xs font-semibold tracking-wide text-piste-500 uppercase mb-2">3. Regrouper dans</p>
              <div className="grid grid-cols-2 gap-2">
                <select value={classeCible} onChange={(e) => changerClasseCible(e.target.value)} className={champ}>
                  {classes.map((c) => <option key={c} value={c}>{c || '(sans nom)'}</option>)}
                  <option value={NOUVEAU}>+ Nouvelle classe…</option>
                </select>
                {classeCible === NOUVEAU ? (
                  <input value={nouvelleClasse} onChange={(e) => setNouvelleClasse(e.target.value)} placeholder="Classe" className={champ} />
                ) : (
                  <select value={eleveCibleId} onChange={(e) => setEleveCibleId(e.target.value)} className={champ}>
                    {elevesClasseCible.map((e) => <option key={e.id} value={e.id}>{e.prenom} {e.nom}</option>)}
                    <option value={NOUVEAU}>+ Nouvel élève…</option>
                  </select>
                )}
              </div>
              {eleveCibleId === NOUVEAU && (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <input value={nouveauPrenom} onChange={(e) => setNouveauPrenom(e.target.value)} placeholder="Prénom" className={champ} />
                  <input value={nouveauNom} onChange={(e) => setNouveauNom(e.target.value)} placeholder="Nom" className={champ} />
                </div>
              )}
              {eleveCibleId === NOUVEAU && cibleValide && (
                <p className="text-xs text-piste-500 mt-1.5">{libelleCible} sera créé.</p>
              )}
            </section>

            <label className="flex items-start gap-2.5 cursor-pointer">
              <input type="checkbox" checked={supprimerVides} onChange={(e) => setSupprimerVides(e.target.checked)} className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="text-sm text-piste-700">Retirer de la liste les élèves vidés (ceux à qui il ne reste plus rien)</span>
            </label>

            <button
              onClick={lancer}
              disabled={enCours || !choisis.length || !cibleValide}
              className="w-full bg-piste-800 hover:bg-piste-700 disabled:opacity-40 text-white text-sm font-medium py-3 rounded-xl"
            >
              {enCours ? 'Transfert en cours…' : `Transférer ${choisis.length} élément${choisis.length > 1 ? 's' : ''} vers ${libelleCible}`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
