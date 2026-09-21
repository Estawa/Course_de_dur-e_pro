import { useState } from 'react'
import { RotateCcw, Save } from 'lucide-react'
import { storage } from '../utils/storage'
import { BAREME as BAREME_DEFAUT } from '../utils/bareme'

// Écran de réglage du barème de la note "réelle" (jamais montrée aux élèves, qui ne voient que
// leur note déclarée). Les curseurs modifient un brouillon local ; rien n'est enregistré tant que
// l'enseignant ne clique pas sur "Enregistrer et recalculer" — à ce moment-là seulement, le
// barème personnalisé est sauvegardé (storage.setBareme, synchronisé comme le reste de l'espace)
// ET la note réelle de TOUTES les réalisations déjà enregistrées dans l'espace actif est
// recalculée avec ces nouvelles valeurs (storage.recalculerNotesReelles), toutes classes
// confondues — pas seulement les prochaines séances.
export default function BaremeNotation({ onRealisationsRecalculees }) {
  const [brouillon, setBrouillon] = useState(() => storage.getBareme())
  const [enregistrement, setEnregistrement] = useState(false)
  const [message, setMessage] = useState(null)

  function maj(chemin, valeur) {
    setMessage(null)
    setBrouillon((b) => {
      if (chemin[0] === 'poidsQualiteBloc') {
        return { ...b, poidsQualiteBloc: { ...b.poidsQualiteBloc, [chemin[1]]: valeur } }
      }
      return { ...b, [chemin[0]]: valeur }
    })
  }

  function reinitialiser() {
    setBrouillon(BAREME_DEFAUT)
    setMessage(null)
  }

  async function enregistrer() {
    setEnregistrement(true)
    const nbModifiees = storage.setBareme(brouillon)
    onRealisationsRecalculees?.()
    setEnregistrement(false)
    setMessage(
      nbModifiees > 0
        ? `Barème enregistré — ${nbModifiees} séance${nbModifiees > 1 ? 's' : ''} recalculée${nbModifiees > 1 ? 's' : ''} sur l'ensemble des classes.`
        : 'Barème enregistré — aucune note existante n\'a changé.'
    )
  }

  const q = brouillon.poidsQualiteBloc

  return (
    <section>
      <h3 className="text-xs font-semibold tracking-wide text-piste-500 uppercase mb-1">
        Barème de la note réelle
      </h3>
      <p className="text-xs text-piste-500 mb-5">
        Grille utilisée pour la note "réelle" (Élèves & suivi, moyenne de cycle). Jamais montrée
        aux élèves, qui ne voient que leur note déclarée.
      </p>

      <div className="space-y-4">
        <div className="rounded-xl border border-piste-200 p-4">
          <p className="text-sm font-semibold text-piste-900 mb-1">1 — Plafond distance/durée</p>
          <p className="text-xs text-piste-600">
            Plafond = 20 × (distance/durée réalisée ÷ prévue), jamais &gt; 20. Un élève qui n'a
            couvert que la moitié de la distance prévue ne peut donc pas dépasser <b>10/20</b>.
            Ce principe n'est pas réglable, contrairement aux poids ci-dessous.
          </p>
        </div>

        <div className="rounded-xl border border-piste-200 p-4">
          <p className="text-sm font-semibold text-piste-900 mb-3">2 — Qualité d'exécution</p>
          <Curseur label="Allure tenue" valeur={q.allure} min={0} max={1} step={0.05}
            format={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => maj(['poidsQualiteBloc', 'allure'], v)} />
          <Curseur label="Régularité d'une phase à l'autre" valeur={q.regularite} min={0} max={1} step={0.05}
            format={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => maj(['poidsQualiteBloc', 'regularite'], v)} />
          <Curseur label="Respect de la récupération (Full Power)" valeur={q.recup} min={0} max={1} step={0.05}
            format={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => maj(['poidsQualiteBloc', 'recup'], v)} />
          <p className="text-[11px] text-piste-400 mt-1">
            Poids relatifs (pas besoin de totaliser 100% : renormalisés automatiquement sur les
            critères mesurables pour chaque bloc).
          </p>
        </div>

        <div className="rounded-xl border border-piste-200 p-4">
          <p className="text-sm font-semibold text-piste-900 mb-3">3 — Pénalités de pauses (par bloc)</p>
          <Curseur label="Pauses tolérées avant pénalité" valeur={brouillon.pausesTolereesParBloc} min={0} max={5} step={1}
            format={(v) => `${v}`}
            onChange={(v) => maj(['pausesTolereesParBloc'], v)} />
          <Curseur label="Retrait par pause au-delà" valeur={brouillon.penalitePauseParUnite} min={0} max={3} step={0.5}
            format={(v) => `−${v} pt`}
            onChange={(v) => maj(['penalitePauseParUnite'], v)} />
          <Curseur label="Retrait maximum, par bloc" valeur={brouillon.plafondPenalitePauseBloc} min={0} max={10} step={0.5}
            format={(v) => `−${v} pts`}
            onChange={(v) => maj(['plafondPenalitePauseBloc'], v)} />
        </div>

        <div className="rounded-xl border border-piste-200 p-4">
          <p className="text-sm font-semibold text-piste-900 mb-3">4 — Pénalités de séance (une seule fois)</p>
          <Curseur label="Par prise de pouls non renseignée (4 max)" valeur={brouillon.penalitePoulsManquant} min={0} max={3} step={0.5}
            format={(v) => `−${v} pt`}
            onChange={(v) => maj(['penalitePoulsManquant'], v)} />
          <Curseur label="Échelle de Borg non renseignée" valeur={brouillon.penaliteBorgManquant} min={0} max={5} step={0.5}
            format={(v) => `−${v} pt`}
            onChange={(v) => maj(['penaliteBorgManquant'], v)} />
          <Curseur label="Observation finale non renseignée" valeur={brouillon.penaliteObservationManquante} min={0} max={3} step={0.5}
            format={(v) => `−${v} pt`}
            onChange={(v) => maj(['penaliteObservationManquante'], v)} />
          <Curseur label="Retrait total maximum (séance)" valeur={brouillon.plafondPenaliteSeance} min={0} max={10} step={0.5}
            format={(v) => `−${v} pts`}
            onChange={(v) => maj(['plafondPenaliteSeance'], v)} />
          <p className="text-[11px] text-piste-400 mt-1">
            Le mode "Sans téléphone" (saisie prof) ne recueille jamais le pouls : aucune pénalité
            de pouls ne s'y applique.
          </p>
        </div>
      </div>

      {message && (
        <p className="text-xs text-piste-700 bg-piste-50 border border-piste-200 rounded-xl px-4 py-3 mt-4">
          {message}
        </p>
      )}

      <div className="flex gap-2 mt-4">
        <button
          onClick={enregistrer}
          disabled={enregistrement}
          className="flex-1 flex items-center justify-center gap-2 bg-piste-800 hover:bg-piste-700 disabled:opacity-40 text-white font-medium py-3 rounded-xl transition active:scale-[0.98]"
        >
          <Save size={16} /> {enregistrement ? 'Enregistrement…' : 'Enregistrer et recalculer'}
        </button>
        <button
          onClick={reinitialiser}
          className="flex items-center justify-center gap-2 border-2 border-piste-300 text-piste-700 font-medium px-4 py-3 rounded-xl transition active:scale-[0.98]"
        >
          <RotateCcw size={16} />
        </button>
      </div>
    </section>
  )
}

function Curseur({ label, valeur, min, max, step, format, onChange }) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-piste-600">{label}</span>
        <span className="font-medium text-piste-900 tabular-nums">{format(valeur)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={valeur}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-piste-800"
      />
    </div>
  )
}
