import { useRef, useState } from 'react'
import { Upload, Check, AlertTriangle, X } from 'lucide-react'
import { parserFichierEleves, regrouperParClasse } from '../utils/eleves'
import { storage } from '../utils/storage'

export default function ImportEleves({ onImporte, onFermer }) {
  const [apercu, setApercu] = useState(null) // { classe: [{nom, prenom, classe}] }
  const [erreur, setErreur] = useState('')
  const [classeUnique, setClasseUnique] = useState('')
  const inputRef = useRef(null)

  async function traiterFichier(file) {
    setErreur('')
    setApercu(null)
    try {
      const liste = await parserFichierEleves(file, classeUnique.trim().toUpperCase())
      if (liste.length === 0) {
        setErreur("Aucun élève reconnu dans ce fichier. Vérifie qu'il contient bien des colonnes Nom / Prénom (et Classe).")
        return
      }
      setApercu(regrouperParClasse(liste))
    } catch (e) {
      setErreur("Impossible de lire ce fichier. Formats acceptés : CSV, XLSX, ODS.")
    }
  }

  function handleFichier(e) {
    const file = e.target.files?.[0]
    if (file) traiterFichier(file)
  }

  function confirmerImport() {
    const liste = []
    Object.entries(apercu).forEach(([classe, eleves]) => {
      eleves.forEach((e) => liste.push({ ...e, classe }))
    })
    storage.fusionnerRoster(liste)
    onImporte()
  }

  const totalEleves = apercu ? Object.values(apercu).reduce((n, l) => n + l.length, 0) : 0

  return (
    <div className="fixed inset-0 z-30 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-piste-100">
          <h3 className="font-display text-lg text-piste-900">Importer des élèves</h3>
          <button onClick={onFermer} className="p-1.5 rounded-full hover:bg-piste-100 text-piste-500">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {!apercu && (
            <>
              <p className="text-sm text-piste-600">
                Importe un export de <span className="font-medium">EPS Pro</span> (CSV) ou un fichier CSV, ODS ou Excel
                contenant les colonnes Nom, Prénom et Classe (une seule classe par fichier possible aussi).
              </p>
              <div>
                <label className="block text-sm font-medium text-piste-800 mb-1">
                  Classe par défaut (si le fichier ne contient pas de colonne Classe)
                </label>
                <input
                  value={classeUnique}
                  onChange={(e) => setClasseUnique(e.target.value)}
                  placeholder="Ex : 2NDE4"
                  className="w-full rounded-xl border border-piste-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-piste-500"
                />
              </div>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,.xlsx,.xls,.ods,text/csv"
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

          {apercu && (
            <>
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
                      {eleves.map((e) => `${e.prenom} ${e.nom}`).join(', ')}
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
                  onClick={() => setApercu(null)}
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
