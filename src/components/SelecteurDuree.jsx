// Sélecteur de durée réutilisable : deux menus déroulants (minutes / secondes),
// piloté par une valeur unique en secondes totales (valeurSec) via onChange(nouvelleValeurSec).
// minutesMax fixe la plage proposée (étendue automatiquement si la valeur en cours la dépasse déjà).
export default function SelecteurDuree({ valeurSec, onChange, minutesMax = 30, className = '' }) {
  const total = Number(valeurSec) || 0
  const minutes = Math.floor(total / 60)
  const secondes = total % 60

  const bordeMinutes = Math.max(minutesMax, minutes)
  const optionsMinutes = Array.from({ length: bordeMinutes + 1 }, (_, i) => i)
  const optionsSecondes = Array.from({ length: 60 }, (_, i) => i)

  return (
    <div className={`flex items-center gap-1.5 flex-wrap ${className}`}>
      <select
        value={minutes}
        onChange={(e) => onChange(Number(e.target.value) * 60 + secondes)}
        className="min-w-0 flex-1 rounded-lg border border-piste-200 px-2 py-1.5 text-sm"
        aria-label="Minutes"
      >
        {optionsMinutes.map((m) => (
          <option key={m} value={m}>{m} min</option>
        ))}
      </select>
      <select
        value={secondes}
        onChange={(e) => onChange(minutes * 60 + Number(e.target.value))}
        className="min-w-0 flex-1 rounded-lg border border-piste-200 px-2 py-1.5 text-sm"
        aria-label="Secondes"
      >
        {optionsSecondes.map((s) => (
          <option key={s} value={s}>{String(s).padStart(2, '0')} s</option>
        ))}
      </select>
    </div>
  )
}
