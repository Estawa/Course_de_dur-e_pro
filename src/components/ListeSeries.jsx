import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from 'lucide-react'
import FullPowerBuilder from './FullPowerBuilder'
import SelecteurDuree from './SelecteurDuree'
import { structureVide } from '../utils/fullpower'

// Liste éditable des séries d'un niveau (anciennement "blocs" — le stockage interne garde le
// nom `blocs` pour rester compatible avec les séances et réalisations déjà enregistrées).
// Utilisée par l'éditeur de séance enseignant (séries Simple ou Full Power) et par la Séance
// vierge élève (séries Full Power uniquement).
// Chaque série peut être dupliquée, supprimée et déplacée (↑/↓).

export function serieSimpleVide() {
  return { id: crypto.randomUUID(), mode: 'simple', distance_m: 400, duree_s: 120 }
}

export function serieFullPowerVide() {
  return { id: crypto.randomUUID(), mode: 'fullpower', structure: structureVide() }
}

function cloner(b) {
  return { ...JSON.parse(JSON.stringify(b)), id: crypto.randomUUID() }
}

export default function ListeSeries({ series, onChange, avecModeSimple = true }) {
  function maj(id, champ, valeur) {
    onChange(series.map((b) => (b.id === id ? { ...b, [champ]: valeur } : b)))
  }

  function changerMode(id, mode) {
    onChange(series.map((b) => (b.id !== id || b.mode === mode ? b : { ...(mode === 'simple' ? serieSimpleVide() : serieFullPowerVide()), id: b.id })))
  }

  function ajouter() {
    onChange([...series, avecModeSimple ? serieSimpleVide() : serieFullPowerVide()])
  }

  function dupliquer(index) {
    const n = [...series]
    n.splice(index + 1, 0, cloner(series[index]))
    onChange(n)
  }

  function supprimer(id) {
    onChange(series.filter((b) => b.id !== id))
  }

  function deplacer(index, sens) {
    const cible = index + sens
    if (cible < 0 || cible >= series.length) return
    const n = [...series]
    ;[n[index], n[cible]] = [n[cible], n[index]]
    onChange(n)
  }

  return (
    <div>
      <div className="space-y-4 mb-2">
        {series.map((b, i) => (
          <div key={b.id} className="bg-piste-50 rounded-lg p-3">
            <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
              <span className="text-sm font-display text-piste-900">Partie {i + 1}</span>
              <div className="flex items-center gap-1 flex-wrap justify-end">
                {avecModeSimple && (
                  <div className="flex gap-1 mr-1">
                    {['simple', 'fullpower'].map((mode) => (
                      <button
                        key={mode}
                        onClick={() => changerMode(b.id, mode)}
                        className={`text-[11px] px-2 py-1 rounded-full border transition ${b.mode === mode ? 'bg-piste-800 text-white border-piste-800' : 'border-piste-200 text-piste-700'}`}
                      >
                        {mode === 'simple' ? 'Simple' : 'Full Power'}
                      </button>
                    ))}
                  </div>
                )}
                <BoutonIcone titre="Monter" disabled={i === 0} onClick={() => deplacer(i, -1)}><ArrowUp size={14} /></BoutonIcone>
                <BoutonIcone titre="Descendre" disabled={i === series.length - 1} onClick={() => deplacer(i, 1)}><ArrowDown size={14} /></BoutonIcone>
                <BoutonIcone titre="Dupliquer la partie" onClick={() => dupliquer(i)}><Copy size={14} /></BoutonIcone>
                {series.length > 1 && (
                  <button onClick={() => supprimer(b.id)} title="Supprimer la partie" className="p-1 rounded-full hover:bg-[#fbeeea] text-alerte shrink-0">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>

            {b.mode === 'simple' ? (
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="number"
                  value={b.distance_m}
                  onChange={(e) => maj(b.id, 'distance_m', e.target.value)}
                  className="w-24 rounded-lg border border-piste-200 px-2.5 py-1.5 text-sm"
                  placeholder="Distance (m)"
                />
                <span className="text-xs text-piste-500">m en</span>
                <SelecteurDuree valeurSec={b.duree_s} onChange={(v) => maj(b.id, 'duree_s', v)} />
              </div>
            ) : (
              <FullPowerBuilder
                structureInitiale={b.structure}
                estDerniere={i === series.length - 1}
                onChange={(structure) => maj(b.id, 'structure', structure)}
              />
            )}
          </div>
        ))}
      </div>
      <button onClick={ajouter} className="flex items-center gap-1 text-xs font-medium text-piste-700 hover:text-piste-900">
        <Plus size={13} /> Ajouter une partie
      </button>
    </div>
  )
}

function BoutonIcone({ titre, disabled, onClick, children }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={titre}
      className="p-1 rounded-full text-piste-600 hover:bg-piste-100 disabled:opacity-25"
    >
      {children}
    </button>
  )
}
