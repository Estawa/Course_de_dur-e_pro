import { useRef, useState } from 'react'
import { Upload, AlertTriangle, X, ChevronLeft } from 'lucide-react'
import { parserLignesBrutes, deviverRole, separerNomPrenom, normaliserSexe, normaliser } from '../utils/eleves'
import { storage } from '../utils/storage'

const CIBLES_IMPORT = [
  { id: 'nomComplet', label: 'Nom + Prénom (colonne unique)' },
  { id: 'nom', label: 'Nom' },
  { id: 'prenom', label: 'Prénom' },
  { id: 'classe', label: 'Classe' },
  { id: 'sexe', label: 'Sexe' }
]

export default function ImportEleves({ onImporte, onFermer }) {
  const [etape, setEtape] = useState('choix') // choix | apercuBrut | mapping | apercu
  const [nomFichier, setNomFichier] = useState('')
  const [enTetes, setEnTetes] = useState([])
  const [lignesDonnees, setLignesDonnees] = useState([])
  const [cibles, setCibles] = useState({}) // { indexColonne: 'nom' | 'prenom' | 'nomComplet' | 'classe' | 'sexe' }
  const [cochees, setCochees] = useState([])
  const [classeParDefaut, setClasseParDefaut] = useState('')
  const [erreur, setErreur] = useState('')
  const inputRef = useRef(null)

  const indexPour = (cible) => {
    const trouve = Object.entries(cibles).find(([, c]) => c === cible)
    return trouve ? Number(trouve[0]) : undefined
  }

  async function handleFichier(file) {
    setErreur('')
    setNomFichier(file.name)
    try {
      const lignes = await parserLignesBrutes(file)
      if (lignes.length < 2) {
        setErreur('Le fichier ne contient pas assez de données (en-tête + au moins une ligne).')
        return
      }
      const [entete, ...reste] = lignes
      const enTetesStr = entete.map((h) => String(h).trim())
      setEnTetes(enTetesStr)
      setLignesDonnees(reste)
      const devine = {}
      enTetesStr.forEach((h, i) => {
        const role = deviverRole(h)
        if (role !== 'ignorer') devine[i] = role
      })
      setCibles(devine)
      setCochees(reste.map(() => true))
      setEtape('apercuBrut')
    } catch (e) {
      setErreur('Impossible de lire ce fichier (format non reconnu). Formats acceptés : .csv, .xlsx, .ods')
    }
  }

  const mappingValide = indexPour('nomComplet') !== undefined || indexPour('nom') !== undefined
  const classeMappee = indexPour('classe') !== undefined

  function toggle(i) {
    setCochees((c) => c.map((v, idx) => (idx === i ? !v : v)))
  }
  function toutCocher(v) {
    setCochees((c) => c.map(() => v))
  }

  function construireLigne(ligne) {
    const iNom = indexPour('nom')
    const iPrenom = indexPour('prenom')
    const iNomComplet = indexPour('nomComplet')
    const iClasse = indexPour('classe')
    const iSexe = indexPour('sexe')

    let nom = iNom !== undefined ? String(ligne[iNom] || '').trim() : ''
    let prenom = iPrenom !== undefined ? String(ligne[iPrenom] || '').trim() : ''
    if (iNomComplet !== undefined && !nom && !prenom) {
      const sep = separerNomPrenom(ligne[iNomComplet])
      nom = sep.nom
      prenom = sep.prenom
    }
    const classe = (iClasse !== undefined ? String(ligne[iClasse] || '').trim() : classeParDefaut).trim().toUpperCase()
    const sexe = iSexe !== undefined ? normaliserSexe(ligne[iSexe]) : ''
    const existant = classe
      ? storage.getElevesClasse(classe).find(
          (e) => normaliser(e.nom) === normaliser(nom) && normaliser(e.prenom) === normaliser(prenom)
        )
      : null
    return { matchId: existant ? existant.id : null, nom, prenom, classe, sexe }
  }

  function construire() {
    return lignesDonnees
      .filter((_, i) => cochees[i])
      .map(construireLigne)
      .filter((e) => e.nom !== '' || e.prenom !== '')
  }

  function valider(mode) {
    if (!classeMappee && !classeParDefaut.trim()) {
      setErreur("Indique une classe par défaut, ou associe une colonne \"Classe\".")
      return
    }
    const eleves = construire()
    if (eleves.length === 0) {
      setErreur('Aucun élève sélectionné.')
      return
    }
    storage.appliquerImportRoster(eleves, mode)
    onImporte()
  }

  function recommencer() {
    setEnTetes([])
    setLignesDonnees([])
    setCibles({})
    setCochees([])
    setErreur('')
    setEtape('choix')
  }

  const lignesConstruites = etape === 'apercu' ? lignesDonnees.map(construireLigne) : []
  const construitsCoches = lignesConstruites.filter((_, i) => cochees[i]).filter((e) => e.nom !== '' || e.prenom !== '')
  const nbExistants = construitsCoches.filter((e) => e.matchId).length

  return (
    <div className="fixed inset-0 z-30 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-piste-100">
          <h3 className="font-display text-lg text-piste-900">Importer une liste d'élèves</h3>
          <button onClick={onFermer} className="p-1.5 rounded-full hover:bg-piste-100 text-piste-500">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {erreur && (
            <p className="text-alerte text-sm flex items-center gap-1.5 bg-[#fbeeea] rounded-lg px-3 py-2">
              <AlertTriangle size={14} /> {erreur}
            </p>
          )}

          {etape === 'choix' && (
            <>
              <p className="text-sm text-piste-600">Formats acceptés : .csv, .xlsx, .ods (exports Pronote inclus).</p>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,.txt,.xlsx,.xls,.ods"
                onChange={(e) => e.target.files[0] && handleFichier(e.target.files[0])}
                className="hidden"
              />
              <button
                onClick={() => inputRef.current?.click()}
                className="w-full flex flex-col items-center gap-2 border-2 border-dashed border-piste-300 rounded-xl py-8 text-piste-600 hover:border-piste-500 hover:bg-piste-50 transition"
              >
                <Upload size={22} />
                <span className="text-sm font-medium">Toucher pour choisir un fichier</span>
              </button>
            </>
          )}

          {etape === 'apercuBrut' && (
            <>
              <p className="text-xs text-piste-500">
                {nomFichier} · {enTetes.length} colonne(s) · {lignesDonnees.length} ligne(s)
              </p>
              <p className="text-sm text-piste-700">Aperçu du fichier tel quel, avant de choisir les colonnes à utiliser :</p>
              <div className="overflow-auto border border-piste-100 rounded-xl max-h-72">
                <table className="text-xs w-full border-collapse">
                  <thead>
                    <tr>
                      {enTetes.map((h, i) => (
                        <th key={i} className="sticky top-0 bg-piste-50 border-b border-piste-100 px-2 py-1.5 text-left whitespace-nowrap text-piste-800">
                          {h || `Colonne ${i + 1}`}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {lignesDonnees.slice(0, 30).map((ligne, i) => (
                      <tr key={i}>
                        {enTetes.map((_, j) => (
                          <td key={j} className="border-b border-piste-50 px-2 py-1.5 whitespace-nowrap text-piste-600">
                            {String(ligne[j] ?? '').trim() || '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {lignesDonnees.length > 30 && (
                <p className="text-[11px] text-piste-500">
                  … et {lignesDonnees.length - 30} ligne(s) de plus (non affichées ici, mais bien importées).
                </p>
              )}
              <div className="flex items-center justify-between pt-1">
                <button onClick={recommencer} className="flex items-center gap-1 text-sm text-piste-600">
                  <ChevronLeft size={16} /> Changer de fichier
                </button>
                <button onClick={() => setEtape('mapping')} className="bg-piste-800 hover:bg-piste-700 text-white font-medium px-4 py-2 rounded-xl text-sm transition">
                  Choisir les colonnes →
                </button>
              </div>
            </>
          )}

          {etape === 'mapping' && (
            <>
              <p className="text-xs text-piste-500">{nomFichier} · {lignesDonnees.length} ligne(s) détectée(s)</p>
              <p className="text-sm text-piste-700">Pour chaque colonne de ton fichier, choisis ce qu'elle représente :</p>
              <div className="space-y-2.5">
                {enTetes.map((h, i) => (
                  <div key={i}>
                    <p className="text-[11px] text-piste-500 mb-1">{h || `Colonne ${i + 1}`}</p>
                    <select
                      value={cibles[i] ?? ''}
                      onChange={(e) =>
                        setCibles((m) => {
                          const suivant = { ...m }
                          if (e.target.value === '') delete suivant[i]
                          else suivant[i] = e.target.value
                          return suivant
                        })
                      }
                      className="w-full rounded-xl border border-piste-200 px-3.5 py-2 text-sm bg-white"
                    >
                      <option value="">— Non importé —</option>
                      {CIBLES_IMPORT.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              {!classeMappee && (
                <div>
                  <label className="block text-sm font-medium text-piste-800 mb-1">
                    Aucune colonne "Classe" choisie : classe à appliquer à tous ces élèves
                  </label>
                  <input
                    value={classeParDefaut}
                    onChange={(e) => setClasseParDefaut(e.target.value)}
                    placeholder="Ex : 2NDE4"
                    className="w-full rounded-xl border border-piste-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-piste-500"
                  />
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <button onClick={() => setEtape('apercuBrut')} className="flex items-center gap-1 text-sm text-piste-600">
                  <ChevronLeft size={16} /> Revenir à l'aperçu
                </button>
                <button
                  onClick={() => {
                    if (!mappingValide) {
                      setErreur('Associe au minimum une colonne "Nom" (ou "Nom + Prénom").')
                      return
                    }
                    setErreur('')
                    setEtape('apercu')
                  }}
                  className="bg-piste-800 hover:bg-piste-700 text-white font-medium px-4 py-2 rounded-xl text-sm transition"
                >
                  Aperçu →
                </button>
              </div>
            </>
          )}

          {etape === 'apercu' && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-xs text-piste-500">{cochees.filter(Boolean).length} / {lignesDonnees.length} sélectionné(s)</p>
                <div className="flex gap-3">
                  <button onClick={() => toutCocher(true)} className="text-[11px] font-medium text-piste-700">Tout cocher</button>
                  <button onClick={() => toutCocher(false)} className="text-[11px] font-medium text-piste-500">Tout décocher</button>
                </div>
              </div>
              <p className="text-[11px] text-piste-500">
                {nbExistants} correspondent à des élèves déjà présents (mise à jour, sans rien effacer) · {construitsCoches.length - nbExistants} nouveau(x)
              </p>

              <div className="max-h-64 overflow-y-auto border border-piste-100 rounded-xl divide-y divide-piste-50">
                {lignesConstruites.map((e, i) => (
                  <label key={i} className={`flex items-center gap-2.5 px-3 py-2 ${cochees[i] ? '' : 'opacity-40'}`}>
                    <input type="checkbox" checked={cochees[i]} onChange={() => toggle(i)} className="rounded" />
                    <span className="text-sm text-piste-900 flex-1">
                      {e.prenom} {e.nom} <span className="text-piste-400 text-xs">· {e.classe}</span>
                      {e.sexe && <span className="text-piste-400 text-xs"> · {e.sexe}</span>}
                    </span>
                    {(e.nom || e.prenom) && (
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${e.matchId ? 'bg-[#fbeeea] text-alerte' : 'bg-piste-100 text-piste-700'}`}>
                        {e.matchId ? 'mise à jour' : 'nouveau'}
                      </span>
                    )}
                  </label>
                ))}
              </div>

              <div className="flex gap-2">
                <button onClick={() => valider('ajouter')} className="flex-1 bg-piste-800 hover:bg-piste-700 text-white font-medium py-2.5 rounded-xl text-sm transition">
                  Mettre à jour / ajouter
                </button>
                <button
                  onClick={() => {
                    if (confirm('Cette option retire de chaque classe concernée tout élève absent du fichier (les élèves reconnus gardent leur fiche, PIN compris). Continuer ?')) {
                      valider('remplacer')
                    }
                  }}
                  className="flex-1 border border-piste-200 text-alerte font-medium py-2.5 rounded-xl text-sm hover:bg-[#fbeeea] transition"
                >
                  Remplacer la liste
                </button>
              </div>
              <button onClick={() => setEtape('mapping')} className="w-full text-center text-xs text-piste-500">
                ← Revenir au choix des colonnes
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
