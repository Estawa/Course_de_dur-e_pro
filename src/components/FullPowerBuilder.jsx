import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { typeVide, dureeTotaleStructure } from '../utils/fullpower'
import { formatDuree } from '../utils/calc'

const LETTRES = ['A', 'B', 'C', 'D']

export default function FullPowerBuilder({ structureInitiale, onChange }) {
  const [types, setTypes] = useState(structureInitiale?.types || [typeVide('A')])
  const [sequence, setSequence] = useState(structureInitiale?.sequence || [])
  const [nbTours, setNbTours] = useState(structureInitiale?.nbTours || 1)
  const [guidage, setGuidage] = useState(structureInitiale?.guidage || 'gps')

  function emettre(nTypes, nSequence, nNbTours, nGuidage) {
    onChange({ types: nTypes, sequence: nSequence, nbTours: nNbTours, guidage: nGuidage })
  }

  function ajouterType() {
    if (types.length >= 4) return
    const nouveaux = [...types, typeVide(LETTRES[types.length])]
    setTypes(nouveaux)
    emettre(nouveaux, sequence, nbTours, guidage)
  }

  function majType(id, champ, valeur) {
    const nouveaux = types.map((t) => (t.id === id ? { ...t, [champ]: valeur } : t))
    setTypes(nouveaux)
    emettre(nouveaux, sequence, nbTours, guidage)
  }

  function supprimerType(id) {
    const nouveaux = types.filter((t) => t.id !== id)
    const nSeq = sequence.filter((s) => s.typeId !== id)
    setTypes(nouveaux)
    setSequence(nSeq)
    emettre(nouveaux, nSeq, nbTours, guidage)
  }

  function ajouterSequence() {
    if (!types.length) return
    const nSeq = [...sequence, { typeId: types[0].id, repetitions: 4 }]
    setSequence(nSeq)
    emettre(types, nSeq, nbTours, guidage)
  }

  function majSequence(index, champ, valeur) {
    const nSeq = sequence.map((s, i) => (i === index ? { ...s, [champ]: valeur } : s))
    setSequence(nSeq)
    emettre(types, nSeq, nbTours, guidage)
  }

  function supprimerSequence(index) {
    const nSeq = sequence.filter((_, i) => i !== index)
    setSequence(nSeq)
    emettre(types, nSeq, nbTours, guidage)
  }

  function changerGuidage(mode) {
    setGuidage(mode)
    emettre(types, sequence, nbTours, mode)
  }

  function changerNbTours(val) {
    setNbTours(val)
    emettre(types, sequence, val, guidage)
  }

  const dureeTotale = dureeTotaleStructure({ types, sequence, nbTours: Number(nbTours) || 1 })

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-piste-500">Types de répétition</p>
          {types.length < 4 && (
            <button onClick={ajouterType} className="flex items-center gap-1 text-xs font-medium text-piste-700">
              <Plus size={13} /> Type {LETTRES[types.length]}
            </button>
          )}
        </div>
        <div className="space-y-3">
          {types.map((t) => (
            <div key={t.id} className="border border-piste-100 rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="font-display text-piste-900">Type {t.lettre}</span>
                {types.length > 1 && (
                  <button onClick={() => supprimerType(t.id)} className="text-alerte p-1">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <ChampNombre label="% VMA travail" valeur={t.pct_vma_travail} onChange={(v) => majType(t.id, 'pct_vma_travail', v)} />
                <ChampNombre label="Temps travail (s)" valeur={t.duree_travail_s} onChange={(v) => majType(t.id, 'duree_travail_s', v)} />
                <ChampNombre label="% VMA récup" valeur={t.pct_vma_recup} onChange={(v) => majType(t.id, 'pct_vma_recup', v)} />
                <ChampNombre label="Temps récup (s)" valeur={t.duree_recup_s} onChange={(v) => majType(t.id, 'duree_recup_s', v)} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-piste-500">Séquence</p>
          <button onClick={ajouterSequence} className="flex items-center gap-1 text-xs font-medium text-piste-700">
            <Plus size={13} /> Ajouter
          </button>
        </div>
        {sequence.length === 0 && <p className="text-xs text-piste-500">Ajoute au moins un type dans la séquence.</p>}
        <div className="space-y-2">
          {sequence.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <select
                value={s.typeId}
                onChange={(e) => majSequence(i, 'typeId', e.target.value)}
                className="rounded-lg border border-piste-200 px-2 py-1.5 text-sm flex-1"
              >
                {types.map((t) => (
                  <option key={t.id} value={t.id}>Type {t.lettre}</option>
                ))}
              </select>
              <span className="text-xs text-piste-500">×</span>
              <input
                type="number"
                value={s.repetitions}
                onChange={(e) => majSequence(i, 'repetitions', Number(e.target.value))}
                className="w-16 rounded-lg border border-piste-200 px-2 py-1.5 text-sm"
              />
              <button onClick={() => supprimerSequence(i)} className="text-alerte p-1">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <ChampNombre label="Nombre de tours de la séquence" valeur={nbTours} onChange={changerNbTours} />
        <div>
          <label className="block text-xs text-piste-600 mb-1">Guidage</label>
          <div className="flex gap-1.5">
            {['gps', 'minuteur'].map((mode) => (
              <button
                key={mode}
                onClick={() => changerGuidage(mode)}
                className={`flex-1 text-xs py-1.5 rounded-lg border transition ${guidage === mode ? 'bg-piste-800 text-white border-piste-800' : 'border-piste-200 text-piste-700'}`}
              >
                {mode === 'gps' ? 'GPS' : 'Minuteur'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <p className="text-xs text-piste-500">Durée totale estimée : {formatDuree(dureeTotale)}</p>
    </div>
  )
}

function ChampNombre({ label, valeur, onChange }) {
  return (
    <div>
      <label className="block text-xs text-piste-600 mb-1">{label}</label>
      <input
        type="number"
        value={valeur}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-lg border border-piste-200 px-2.5 py-1.5 text-sm"
      />
    </div>
  )
}
