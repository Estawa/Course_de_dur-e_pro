import { useEffect, useState } from 'react'
import { Trash2, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react'
import { loadEspaceStrict } from '../utils/cloud'
import { analyserEspace, effacerClasses, CLASSE_INCONNUE } from '../utils/finAnnee'

const CONSERVER_PAR_DEFAUT = ['PROF']
const libelleClasse = (c) => (c === CLASSE_INCONNUE ? 'Sans classe identifiable' : c || '(sans nom)')

// Remise à zéro de fin d'année (admin) : efface les données élèves (liste, PIN, séances réalisées,
// tests VMA, Fartlek) des classes cochées, dans mon espace et/ou celui de chaque collègue. La
// bibliothèque de séances, le barème et les accès de chacun restent intacts.
export default function FinAnnee({ accesConfig, onTermine }) {
  const espaces = [
    { id: 'admin', nom: `${accesConfig?.nomAdmin || 'Admin'} (moi)` },
    ...(accesConfig?.collegues || []).map((c) => ({ id: c.id, nom: c.nom }))
  ]
  const [etat, setEtat] = useState({}) // id → { chargement, erreur, data, classes }
  const [coches, setCoches] = useState({}) // id → Set des classes à effacer
  const [confirmation, setConfirmation] = useState('')
  const [enCours, setEnCours] = useState(false)
  const [resultats, setResultats] = useState(null)

  async function charger() {
    setResultats(null)
    const initial = {}
    espaces.forEach((e) => { initial[e.id] = { chargement: true } })
    setEtat(initial)
    await Promise.all(
      espaces.map(async (esp) => {
        try {
          const data = await loadEspaceStrict(esp.id)
          const classes = analyserEspace(data)
          setEtat((p) => ({ ...p, [esp.id]: { data, classes } }))
          setCoches((p) => ({
            ...p,
            [esp.id]: new Set(classes.map((c) => c.nom).filter((n) => !CONSERVER_PAR_DEFAUT.includes((n || '').toUpperCase())))
          }))
        } catch (e) {
          setEtat((p) => ({ ...p, [esp.id]: { erreur: e.message || 'Lecture impossible' } }))
        }
      })
    )
  }
  useEffect(() => { charger() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function basculer(espId, classe) {
    setCoches((p) => {
      const s = new Set(p[espId] || [])
      s.has(classe) ? s.delete(classe) : s.add(classe)
      return { ...p, [espId]: s }
    })
  }

  const total = espaces.reduce(
    (acc, esp) => {
      const st = etat[esp.id]
      if (!st?.classes) return acc
      st.classes.filter((c) => coches[esp.id]?.has(c.nom)).forEach((c) => {
        acc.eleves += c.nbEleves
        acc.seances += c.nbSeances
        acc.vma += c.nbFichesVma
      })
      return acc
    },
    { eleves: 0, seances: 0, vma: 0 }
  )
  const rienAEffacer = total.eleves + total.seances + total.vma === 0
  const chargementEnCours = espaces.some((e) => etat[e.id]?.chargement)

  async function lancer() {
    if (confirmation.trim().toUpperCase() !== 'EFFACER' || rienAEffacer) return
    setEnCours(true)
    const res = []
    for (const esp of espaces) {
      const st = etat[esp.id]
      const classes = Array.from(coches[esp.id] || [])
      if (!st?.data || classes.length === 0) continue
      try {
        // Relecture juste avant d'effacer, pour inclure ce qui a été enregistré entre-temps.
        const frais = await loadEspaceStrict(esp.id)
        res.push({ nom: esp.nom, ...(await effacerClasses(esp.id, frais, classes)) })
      } catch (e) {
        res.push({ nom: esp.nom, erreur: e.message || 'Échec' })
      }
    }
    setResultats(res)
    setConfirmation('')
    setEnCours(false)
    await onTermine()
  }

  return (
    <section className="mt-10 border-t border-piste-100 pt-6">
      <h3 className="text-xs font-semibold tracking-wide text-alerte uppercase mb-2 flex items-center gap-1.5">
        <Trash2 size={14} /> Fin d'année : effacer les données élèves
      </h3>
      <p className="text-xs text-piste-600 mb-2">
        Efface, pour les classes cochées : la liste des élèves et leurs codes PIN, les séances réalisées, les tests VMA et les
        Fartlek. <strong>Les bibliothèques de séances, les barèmes et les accès de chacun sont conservés.</strong>
      </p>
      <p className="text-xs text-piste-600 mb-4">
        Pense à exporter avant (« Exporter CSV » ou « Exporter pour EPS Pro » dans Élèves &amp; suivi, espace par espace via
        Vue globale) : l'effacement est définitif.
      </p>

      <div className="flex justify-end mb-2">
        <button onClick={charger} className="flex items-center gap-1.5 text-xs font-medium text-piste-700">
          <RefreshCw size={13} className={chargementEnCours ? 'animate-spin' : ''} /> Relire
        </button>
      </div>

      <div className="space-y-3">
        {espaces.map((esp) => {
          const st = etat[esp.id] || {}
          return (
            <div key={esp.id} className="rounded-xl border border-piste-100 px-3 py-3">
              <p className="text-sm font-medium text-piste-900 mb-2">{esp.nom}</p>
              {st.chargement && <p className="text-xs text-piste-500">Lecture…</p>}
              {st.erreur && <p className="text-xs text-alerte">Lecture impossible ({st.erreur}) : rien ne sera effacé dans cet espace.</p>}
              {st.classes && st.classes.length === 0 && <p className="text-xs text-piste-500">Aucune donnée élève.</p>}
              {st.classes && st.classes.length > 0 && (
                <div className="space-y-1">
                  {st.classes.map((c) => {
                    const coche = !!coches[esp.id]?.has(c.nom)
                    return (
                      <label key={c.nom} className="flex items-center gap-2.5 cursor-pointer py-1">
                        <input type="checkbox" checked={coche} onChange={() => basculer(esp.id, c.nom)} className="w-4 h-4 shrink-0" />
                        <span className={`text-sm flex-1 ${coche ? 'text-alerte font-medium' : 'text-piste-900'}`}>
                          {libelleClasse(c.nom)} {!coche && <span className="text-xs text-piste-500 font-normal">· conservée</span>}
                        </span>
                        <span className="text-[11px] text-piste-500 shrink-0">
                          {c.nbEleves} él. · {c.nbSeances} séances · {c.nbFichesVma} VMA
                        </span>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {!resultats && (
        <div className="mt-4 rounded-xl bg-piste-50 px-3 py-3 space-y-3">
          <p className="text-xs text-piste-700 flex items-start gap-1.5">
            <AlertTriangle size={14} className="text-alerte shrink-0 mt-0.5" />
            Seront effacés : {total.eleves} élève{total.eleves > 1 ? 's' : ''}, {total.seances} séance{total.seances > 1 ? 's' : ''} réalisée{total.seances > 1 ? 's' : ''}, {total.vma} fiche{total.vma > 1 ? 's' : ''} VMA/Fartlek.
          </p>
          <input
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            placeholder="Tape EFFACER pour confirmer"
            className="w-full rounded-xl border border-piste-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-alerte"
          />
          <button
            onClick={lancer}
            disabled={enCours || chargementEnCours || rienAEffacer || confirmation.trim().toUpperCase() !== 'EFFACER'}
            className="w-full bg-alerte disabled:opacity-40 text-white text-sm font-medium py-2.5 rounded-xl"
          >
            {enCours ? 'Effacement en cours…' : 'Effacer définitivement'}
          </button>
        </div>
      )}

      {resultats && (
        <div className="mt-4 rounded-xl bg-piste-50 px-3 py-3 space-y-1.5">
          {resultats.length === 0 && <p className="text-xs text-piste-600">Rien n'a été effacé.</p>}
          {resultats.map((r) => (
            <p key={r.nom} className={`text-xs flex items-start gap-1.5 ${r.erreur || r.nbEchecs ? 'text-alerte' : 'text-piste-700'}`}>
              {r.erreur || r.nbEchecs ? <AlertTriangle size={14} className="shrink-0 mt-0.5" /> : <CheckCircle2 size={14} className="shrink-0 mt-0.5" />}
              <span>
                <strong>{r.nom}</strong> :{' '}
                {r.erreur
                  ? `échec (${r.erreur}), rien effacé`
                  : `${r.nbEleves} élèves, ${r.nbSeances} séances, ${r.nbFichesVma} fiches VMA effacés${r.nbEchecs ? ` — ${r.nbEchecs} suppression(s) en échec, relance l'opération` : ''}`}
              </span>
            </p>
          ))}
          <button onClick={charger} className="text-xs font-medium text-piste-800 pt-1">Vérifier ce qu'il reste</button>
        </div>
      )}
    </section>
  )
}
