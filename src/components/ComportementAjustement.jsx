import { useState } from 'react'

const OPTIONS = [
  { valeur: -2, label: '--' },
  { valeur: -1, label: '-' },
  { valeur: 0, label: '=' },
  { valeur: 1, label: '+' },
  { valeur: 2, label: '++' }
]

export default function ComportementAjustement({ realisation, onModifier }) {
  const [commentaireOuvert, setCommentaireOuvert] = useState(false)
  const [commentaire, setCommentaire] = useState(realisation.commentaireComportement || '')
  const ajustement = realisation.ajustementComportement || 0

  function choisir(valeur) {
    onModifier(realisation.id, { ajustementComportement: valeur })
  }

  function validerCommentaire() {
    onModifier(realisation.id, { commentaireComportement: commentaire.trim() })
    setCommentaireOuvert(false)
  }

  return (
    <div className="mt-2 pt-2 border-t border-piste-100">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-piste-500">Comportement / attitude</p>
        <div className="flex items-center gap-1">
          {OPTIONS.map((o) => (
            <button
              key={o.valeur}
              onClick={() => choisir(o.valeur)}
              title={o.valeur === 0 ? 'Neutre' : o.valeur > 0 ? `Bonus +${o.valeur}` : `Malus ${o.valeur}`}
              className={`w-7 h-7 rounded-full text-xs font-medium border transition ${
                ajustement === o.valeur
                  ? o.valeur < 0
                    ? 'bg-alerte text-white border-alerte'
                    : o.valeur > 0
                    ? 'bg-piste-800 text-white border-piste-800'
                    : 'bg-piste-200 border-piste-200 text-piste-800'
                  : 'border-piste-200 text-piste-500'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
      <button onClick={() => setCommentaireOuvert((v) => !v)} className="text-[11px] text-piste-500 underline mt-1">
        {realisation.commentaireComportement ? 'Modifier la remarque' : '+ Ajouter une remarque'}
      </button>
      {commentaireOuvert && (
        <div className="mt-1.5 flex items-center gap-1.5">
          <input
            value={commentaire}
            onChange={(e) => setCommentaire(e.target.value)}
            placeholder="Ex : très investi, a aidé un camarade..."
            className="flex-1 rounded-lg border border-piste-200 px-2.5 py-1.5 text-xs"
          />
          <button onClick={validerCommentaire} className="text-xs font-medium bg-piste-800 text-white px-2.5 py-1.5 rounded-lg">
            OK
          </button>
        </div>
      )}
      {!commentaireOuvert && realisation.commentaireComportement && (
        <p className="text-[11px] text-piste-500 italic mt-1">{realisation.commentaireComportement}</p>
      )}
    </div>
  )
}
