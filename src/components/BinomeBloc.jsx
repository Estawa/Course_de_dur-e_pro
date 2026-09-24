import { useState } from 'react'
import { UserCheck, UserX } from 'lucide-react'

// Après le bilan de chaque bloc en mode binôme : le partenaire sans téléphone a-t-il couru avec
// le porteur du téléphone pendant TOUT le bloc ? Sinon, les mesures GPS ne correspondent plus à
// ce qu'il a réellement couru : son bloc est compté comme non réussi (le prof pourra trancher).
export default function BinomeBloc({ labelBloc, prenomBinome, onValide }) {
  const [present, setPresent] = useState(null)
  const [note, setNote] = useState('')

  return (
    <div className="max-w-md mx-auto px-6 py-10">
      <p className="text-xs uppercase tracking-wide text-piste-500 mb-1 text-center">{labelBloc}</p>
      <h2 className="font-display text-2xl text-piste-900 mb-6 text-center">
        {prenomBinome} a-t-il couru avec toi pendant tout le bloc ?
      </h2>

      <div className="space-y-3 mb-5">
        <button
          onClick={() => setPresent(true)}
          className={`w-full flex items-center gap-3 border-2 rounded-xl px-4 py-3.5 transition ${present === true ? 'border-piste-500 bg-piste-50 text-piste-800' : 'border-piste-100 text-piste-700'}`}
        >
          <UserCheck size={20} className={present === true ? '' : 'text-piste-300'} />
          <span className="font-medium text-sm">Oui, on est restés ensemble</span>
        </button>
        <button
          onClick={() => setPresent(false)}
          className={`w-full flex items-center gap-3 border-2 rounded-xl px-4 py-3.5 transition ${present === false ? 'border-alerte/50 bg-[#fbeeea] text-piste-800' : 'border-piste-100 text-piste-700'}`}
        >
          <UserX size={20} className={present === false ? '' : 'text-piste-300'} />
          <span className="font-medium text-sm">Non, il a décroché ou s'est arrêté</span>
        </button>
      </div>

      {present === false && (
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className="w-full rounded-xl border border-piste-200 px-4 py-2.5 text-sm mb-6 focus:outline-none focus:ring-2 focus:ring-piste-500"
          placeholder="Que s'est-il passé ? (facultatif)"
        />
      )}

      <button
        disabled={present === null}
        onClick={() => onValide({ present, note: present ? '' : note.trim() })}
        className="w-full bg-piste-800 hover:bg-piste-700 disabled:opacity-40 text-white font-medium py-3.5 rounded-xl transition active:scale-[0.98]"
      >
        Valider
      </button>
    </div>
  )
}
