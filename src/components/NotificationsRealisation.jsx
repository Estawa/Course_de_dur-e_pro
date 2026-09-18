import { useState } from 'react'
import { ThumbsUp, ThumbsDown, X } from 'lucide-react'

// Notifications ponctuelles (une ou plusieurs) que le professeur peut poser sur une séance d'un
// élève, positives ou négatives, avec une observation facultative — visibles uniquement côté
// professeur, sur la fiche de suivi de l'élève.
export default function NotificationsRealisation({ realisation, onModifier }) {
  const [formulaire, setFormulaire] = useState(null) // null | 'positive' | 'negative'
  const [observation, setObservation] = useState('')
  const notifications = realisation.notifications || []

  function ajouter() {
    const notif = {
      id: crypto.randomUUID ? crypto.randomUUID() : `n_${Date.now()}`,
      sens: formulaire,
      observation: observation.trim(),
      date: Date.now()
    }
    onModifier(realisation.id, { notifications: [...notifications, notif] })
    setFormulaire(null)
    setObservation('')
  }

  function supprimer(id) {
    onModifier(realisation.id, { notifications: notifications.filter((n) => n.id !== id) })
  }

  return (
    <div className="mt-2 pt-2 border-t border-piste-100">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <p className="text-[11px] text-piste-500">Notifications</p>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setFormulaire('positive')}
            title="Ajouter une notification positive"
            className="flex items-center gap-1 text-[11px] font-medium text-piste-700 border border-piste-200 rounded-full px-2 py-1 hover:bg-piste-50"
          >
            <ThumbsUp size={12} /> +
          </button>
          <button
            onClick={() => setFormulaire('negative')}
            title="Ajouter une notification négative"
            className="flex items-center gap-1 text-[11px] font-medium text-piste-700 border border-piste-200 rounded-full px-2 py-1 hover:bg-piste-50"
          >
            <ThumbsDown size={12} /> +
          </button>
        </div>
      </div>

      {formulaire && (
        <div className="flex items-center gap-1.5 mb-2">
          <input
            value={observation}
            onChange={(e) => setObservation(e.target.value)}
            placeholder="Observation (facultatif)"
            autoFocus
            className="flex-1 rounded-lg border border-piste-200 px-2.5 py-1.5 text-xs"
          />
          <button
            onClick={ajouter}
            className={`text-xs font-medium text-white px-2.5 py-1.5 rounded-lg shrink-0 ${formulaire === 'positive' ? 'bg-piste-800' : 'bg-alerte'}`}
          >
            Ajouter
          </button>
        </div>
      )}

      {notifications.length > 0 && (
        <div className="space-y-1">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-[11px] ${n.sens === 'positive' ? 'bg-piste-50 text-piste-800' : 'bg-[#fbeeea] text-piste-800'}`}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                {n.sens === 'positive' ? <ThumbsUp size={12} className="text-piste-600 shrink-0" /> : <ThumbsDown size={12} className="text-alerte shrink-0" />}
                <span className="truncate">{n.observation || (n.sens === 'positive' ? 'Notification positive' : 'Notification négative')}</span>
              </div>
              <button onClick={() => supprimer(n.id)} className="shrink-0 text-piste-400 hover:text-alerte">
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
