import { useRef, useState } from 'react'
import { Upload, Check, AlertTriangle, X, ChevronLeft } from 'lucide-react'
import { parserLignesBrutes, deviverRole, separerNomComplet, normaliserSexe, regrouperParClasse } from '../utils/eleves'
import { storage } from '../utils/storage'

const ROLES = [
  { valeur: 'ignorer', label: 'Ignorer' },
  { valeur: 'nomComplet', label: 'Nom + Prénom (une seule colonne)' },
  { valeur: 'nom', label: 'Nom' },
  { valeur: 'prenom', label: 'Prénom' },
  { valeur: 'classe', label: 'Classe' },
  { valeur: 'sexe', label: 'Sexe' }
]

export default function ImportEleves({ onImporte, onFermer }) {
  const [etape, setEtape] = useState('fichier') // fichier | mapping | apercu
  const [erreur, setErreur] = useState('')
  const [lignesBrutes, setLignesBrutes] = useState(null)
  const [premiereLigneEnTete, setPremiereLigneEnTete] = useState(true)
  const [mapping, setMapping] = useState([])
  const [ordreNomComplet, setOrdreNomComplet] = useState('nomPrenom')
  const [classeParDefaut, setClasseParDefaut] = useState('')
  const [apercu, setApercu] = useState(null) // { classe: [{nom, prenom, classe}] }
  const inputRef = useRef(null)

  const nbColonnes = lignesBrutes ? Math.max(...lignesBrutes.map((r) => r.length)) : 0
  const ligneEnTete = lignesBrutes && premiereLigneEnTete ? lignesBrutes[0] : null
  const lignesApercuBrut = lignesBrutes ? lignesBrutes.slice(premiereLigneEnTete ? 1 : 0, premiereLigneEnTete ? 9 : 8) : []

  async function traiterFichier(file) {
    setErreur('')
    try {
      const lignes = await parserLignesBrutes(file)
      if (lignes.length === 0) {
        setErreur('Ce fichier semble vide ou illisible.')
        return
      }
      const nbCols = Math.max(...lignes.map((r) => r.length))
      const enTeteProbable = lignes[0]
      const mappingInitial = Array.from({ length: nbCols }, (_, i) => deviverRole(enTeteProbable[i] || ''))
      setLignesBrutes(lignes)
      setMapping(mappingInitial)
      setPremiereLigneEnTete(true)
      setEtape('mapping')
    } catch (e) {
      setErreur('Impossible de lire ce fichier. Formats acceptés : CSV, XLSX, ODS.')
    }
  }

  function handleFichier(e) {
    const file = e.target.files?.[0]
    if (file) traiterFichier(file)
  }

  function changerMapping(index, valeur) {
    setMapping((m) => m.map((v, i) => (i === index ? valeur : v)))
  }

  function colonneIndexPour(role) {
    return mapping.findIndex((r) => r === role)
  }

  function construireApercu() {
    setErreur('')
    const idxNom = colonneIndexPour('nom')
    const idxPrenom = colonneIndexPour('prenom')
    const idxNomComplet = colonneIndexPour('nomComplet')
    const idxClasse = colonneIndexPour('classe')
    const idxSexe = colonneIndexPour('sexe')

    const aNomSepare = idxNom !== -1 && idxPrenom !== -1
    const aNomComplet = idxNomComplet !== -1

    if (!aNomSepare && !aNomComplet) {
      setErreur('Associe au moins une colonne "Nom + Prénom", ou les deux colonnes "Nom" et "Prénom".')
      return
    }
    if (idxClasse === -1 && !classeParDefaut.trim()) {
      setErreur("Indique une classe par défaut, ou associe une colonne \"Classe\".")
      return
    }

    const lignesData = lignesBrutes.slice(premiereLigneEnTete ? 1 : 0)
    const liste = []
    lignesData.forEach((row) => {
      let nom = ''
      let prenom = ''
      if (aNomComplet) {
        const sep = separerNomComplet(row[idxNomComplet] || '', ordreNomComplet)
        nom = sep.nom
        prenom = sep.prenom
      } else {
        nom = (row[idxNom] || '').trim()
        prenom = (row[idxPrenom] || '').trim()
      }
      const classe = idxClasse !== -1 ? (row[idxClasse] || '').trim().toUpperCase() : classeParDefaut.trim().toUpperCase()
      const sexe = idxSexe !== -1 ? normaliserSexe(row[idxSexe]) : ''
      if (nom && prenom && classe) {
        liste.push({ nom, prenom, classe, sexe: sexe || undefined })
      }
    })

    if (liste.length === 0) {
      setErreur("Aucun élève exploitable trouvé avec ce mapping. Vérifie les colonnes choisies ci-dessus.")
      return
    }
    setApercu(regrouperParClasse(liste))
    setEtape('apercu')
  }

  function confirmerImport() {
    const liste = []
    Object.entries(apercu).forEach(([classe, eleves]) => {
      eleves.forEach((e) => liste.push({ ...e, classe }))
    })
    storage.fusionnerRoster(liste)
    onImporte()
  }

  function recommencer() {
    setLignesBrutes(null)
    setMapping([])
    setApercu(null)
    setErreur('')
    setEtape('fichier')
  }

  const totalEleves = apercu ? Object.values(apercu).reduce((n, l) => n + l.length, 0) : 0
  const idxNomComplet = colonneIndexPour('nomComplet')

  return (
    <div className="fixed inset-0 z-30 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-piste-100">
          <h3 className="font-display text-lg text-piste-900">Importer des élèves</h3>
          <button onClick={onFermer} className="p-1.5 rounded-full hover:bg-piste-100 text-piste-500">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {etape === 'fichier' && (
            <>
              <p className="text-sm text-piste-600">
                Importe un export CSV (Pronote, EPS Pro...), un fichier CSV, ODS ou Excel. Tu choisiras ensuite toi-même,
                sur un aperçu du fichier, à quoi correspond chaque colonne.
              </p>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,.txt,.xlsx,.xls,.ods,text/csv"
                onChange={handleFichier}
                className="hidden"
              />
              <button
                onClick={() => inputRef.current?.click()}
                className="w-full flex flex-col items-center gap-2 border-2 border-dashed border-piste-300 rounded-xl py-8 text-piste-600 hover:border-piste-500 hover:bg-piste-50 transition"
              >
                <Upload size={22} />
                <span className="text-sm font-medium">Choisir un fichier (.csv, .xlsx, .ods)</span>
              </button>
              {erreur && (
                <p className="text-alerte text-sm flex items-center gap-1.5">
                  <AlertTriangle size={14} /> {erreur}
                </p>
              )}
            </>
          )}

          {etape === 'mapping' && lignesBrutes && (
            <>
              <button onClick={recommencer} className="flex items-center gap-1 text-sm text-piste-600">
                <ChevronLeft size={16} /> Choisir un autre fichier
              </button>

              <label className="flex items-center gap-2 text-sm text-piste-700">
                <input
                  type="checkbox"
                  checked={premiereLigneEnTete}
                  onChange={(e) => setPremiereLigneEnTete(e.target.checked)}
                  className="rounded"
                />
                La première ligne contient les en-têtes de colonnes
              </label>

              <p className="text-xs text-piste-500">
                Indique à quoi correspond chaque colonne. Aperçu des premières lignes du fichier :
              </p>

              <div className="overflow-x-auto border border-piste-100 rounded-xl">
                <table className="text-xs w-full">
                  <thead>
                    <tr className="bg-piste-50">
                      {Array.from({ length: nbColonnes }).map((_, i) => (
                        <th key={i} className="px-2 py-2 text-left align-top">
                          <p className="text-[10px] text-piste-400 mb-1">
                            Colonne {i + 1}{ligneEnTete?.[i] ? ` · "${ligneEnTete[i]}"` : ''}
                          </p>
                          <select
                            value={mapping[i] || 'ignorer'}
                            onChange={(e) => changerMapping(i, e.target.value)}
                            className="w-full text-xs rounded-lg border border-piste-200 px-1.5 py-1 bg-white"
                          >
                            {ROLES.map((r) => (
                              <option key={r.valeur} value={r.valeur}>
                                {r.label}
                              </option>
                            ))}
                          </select>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {lignesApercuBrut.map((row, ri) => (
                      <tr key={ri} className="border-t border-piste-50">
                        {Array.from({ length: nbColonnes }).map((_, ci) => (
                          <td key={ci} className="px-2 py-1.5 text-piste-700 whitespace-nowrap">
                            {row[ci] || ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {idxNomComplet !== -1 && (
                <div>
                  <label className="block text-sm font-medium text-piste-800 mb-1">
                    Ordre dans la colonne "Nom + Prénom" (utilisé seulement si aucune majuscule n'est détectée)
                  </label>
                  <select
                    value={ordreNomComplet}
                    onChange={(e) => setOrdreNomComplet(e.target.value)}
                    className="w-full rounded-xl border border-piste-200 px-3.5 py-2 text-sm"
                  >
                    <option value="nomPrenom">Nom puis Prénom (ex : MARTIN Léo)</option>
                    <option value="prenomNom">Prénom puis Nom (ex : Léo Martin)</option>
                  </select>
                </div>
              )}

              {colonneIndexPour('classe') === -1 && (
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

              {erreur && (
                <p className="text-alerte text-sm flex items-center gap-1.5">
                  <AlertTriangle size={14} /> {erreur}
                </p>
              )}

              <button
                onClick={construireApercu}
                className="w-full bg-piste-800 hover:bg-piste-700 text-white font-medium py-3 rounded-xl transition"
              >
                Continuer
              </button>
            </>
          )}

          {etape === 'apercu' && apercu && (
            <>
              <button onClick={() => setEtape('mapping')} className="flex items-center gap-1 text-sm text-piste-600">
                <ChevronLeft size={16} /> Revoir le mapping des colonnes
              </button>
              <p className="text-sm text-piste-700 flex items-center gap-1.5">
                <Check size={16} className="text-piste-600" />
                {totalEleves} élève{totalEleves > 1 ? 's' : ''} détecté{totalEleves > 1 ? 's' : ''} sur {Object.keys(apercu).length}{' '}
                classe{Object.keys(apercu).length > 1 ? 's' : ''}
              </p>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {Object.entries(apercu).map(([classe, eleves]) => (
                  <div key={classe} className="border border-piste-100 rounded-xl px-3.5 py-3">
                    <p className="text-xs font-semibold text-piste-500 uppercase tracking-wide mb-1.5">
                      {classe} · {eleves.length}
                    </p>
                    <p className="text-sm text-piste-800 leading-relaxed">
                      {eleves.map((e) => `${e.prenom} ${e.nom}${e.sexe ? ` (${e.sexe})` : ''}`).join(', ')}
                    </p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-piste-500">
                Les élèves déjà présents dans une classe (même nom/prénom) ne seront pas dupliqués ; leur code PIN existant
                est conservé.
              </p>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={recommencer}
                  className="flex-1 border border-piste-200 text-piste-700 font-medium py-2.5 rounded-xl hover:bg-piste-50"
                >
                  Recommencer
                </button>
                <button
                  onClick={confirmerImport}
                  className="flex-1 bg-piste-800 hover:bg-piste-700 text-white font-medium py-2.5 rounded-xl transition"
                >
                  Importer
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
