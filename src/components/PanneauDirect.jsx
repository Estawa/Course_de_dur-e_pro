import { useEffect, useMemo, useState } from 'react'
import { Hand, Radio, CheckCircle2, WifiOff, X, Users } from 'lucide-react'
import { ecouterEnCours } from '../utils/cloud'
import { envoyerArret, MOTIFS_ARRET, PRESENCE_HORS_LIGNE_MS, PRESENCE_EXPIREE_MS } from '../utils/arretProf'
import { libelleNiveau } from '../utils/niveauLabels'

const LIBELLE_TYPE = { seance: 'Séance', fartlek: 'Fartlek', test: 'Test VMA' }

function depuis(ts, maintenant) {
  const min = Math.max(0, Math.floor((maintenant - ts) / 60000))
  if (min < 1) return "à l'instant"
  if (min < 60) return `depuis ${min} min`
  return `depuis ${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`
}

// Onglet "En direct" : élèves en train de courir (séance, Fartlek, test VMA), en temps réel, avec
// possibilité d'arrêter la séance d'un élève ou de toute une classe, après confirmation (motif).
export default function PanneauDirect({ teacherId, classes, nomProf }) {
  const [presences, setPresences] = useState([])
  const [classe, setClasse] = useState(null)
  const [maintenant, setMaintenant] = useState(Date.now())
  const [demande, setDemande] = useState(null) // { cible: 'classe' } | { cible: 'eleves', eleves: [...] }
  const [motif, setMotif] = useState('meteo')
  const [precision, setPrecision] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [message, setMessage] = useState(null)
  const [arretsEnvoyes, setArretsEnvoyes] = useState({}) // eleveId -> ts d'envoi (affichage "envoyé")

  useEffect(() => ecouterEnCours(teacherId, setPresences), [teacherId])
  useEffect(() => {
    const id = setInterval(() => setMaintenant(Date.now()), 20000)
    return () => clearInterval(id)
  }, [])

  const actives = useMemo(
    () => presences.filter((p) => p.maj && maintenant - p.maj < PRESENCE_EXPIREE_MS),
    [presences, maintenant]
  )
  const parClasse = useMemo(() => {
    const m = {}
    actives.forEach((p) => {
      if (!m[p.classe]) m[p.classe] = []
      m[p.classe].push(p)
    })
    Object.values(m).forEach((l) => l.sort((a, b) => `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`, 'fr')))
    return m
  }, [actives])

  const toutesClasses = useMemo(() => {
    const avecCoureurs = Object.keys(parClasse)
    return Array.from(new Set([...avecCoureurs, ...(classes || [])])).sort((a, b) => {
      const da = parClasse[a]?.length ? 0 : 1
      const db = parClasse[b]?.length ? 0 : 1
      return da - db || String(a).localeCompare(String(b), 'fr')
    })
  }, [parClasse, classes])

  const classeActive = classe ?? toutesClasses[0] ?? null
  const coureurs = classeActive != null ? parClasse[classeActive] || [] : []

  function ouvrir(d) {
    setDemande(d)
    setMotif('meteo')
    setPrecision('')
  }

  async function confirmerArret() {
    if (!demande || classeActive == null) return
    setEnvoi(true)
    const eleveIds = demande.cible === 'eleves' ? demande.eleves.map((e) => e.eleveId) : []
    const arret = await envoyerArret({
      teacherId,
      classe: classeActive,
      cible: demande.cible,
      eleveIds,
      motif,
      precision,
      presences: coureurs,
      par: nomProf
    })
    setEnvoi(false)
    if (!arret) {
      setMessage({ ok: false, texte: "L'arrêt n'a pas pu être envoyé (pas de réseau ?). Réessaie." })
      return
    }
    const vises = demande.cible === 'classe' ? coureurs.map((c) => c.eleveId) : eleveIds
    setArretsEnvoyes((prev) => {
      const n = { ...prev }
      vises.forEach((id) => { n[id] = arret.ts })
      return n
    })
    setMessage({
      ok: true,
      texte:
        demande.cible === 'classe'
          ? `Arrêt envoyé à toute la classe ${classeActive}. Les élèves momentanément hors réseau le recevront dès leur reconnexion.`
          : `Arrêt envoyé à ${demande.eleves.map((e) => e.prenom).join(', ')}.`
    })
    setDemande(null)
  }

  return (
    <section>
      <div className="flex items-center gap-2 mb-1">
        <Radio size={15} className="text-piste-700" />
        <h3 className="text-xs font-semibold tracking-wide text-piste-500 uppercase">Élèves en course</h3>
      </div>
      <p className="text-xs text-piste-500 mb-4">
        Mise à jour en temps réel. Si tu arrêtes une séance, elle est notée uniquement sur ce qui a été réalisé
        (parties terminées + partie en cours au prorata du temps couru). Un test VMA arrêté est annulé.
      </p>

      {message && (
        <div className={`flex items-start justify-between gap-2 rounded-xl px-3.5 py-2.5 mb-4 text-xs border ${message.ok ? 'bg-piste-50 border-piste-200 text-piste-800' : 'bg-[#fbeeea] border-alerte/40 text-alerte'}`}>
          <span>{message.texte}</span>
          <button onClick={() => setMessage(null)} className="shrink-0"><X size={14} /></button>
        </div>
      )}

      {toutesClasses.length === 0 ? (
        <p className="text-sm text-piste-500">Aucune classe pour l'instant.</p>
      ) : (
        <>
          <div className="flex gap-2 overflow-x-auto mb-4 pb-1">
            {toutesClasses.map((c) => {
              const n = parClasse[c]?.length || 0
              return (
                <button
                  key={c}
                  onClick={() => setClasse(c)}
                  className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border transition ${classeActive === c ? 'bg-piste-800 text-white border-piste-800' : 'border-piste-200 text-piste-600'}`}
                >
                  {c || '(sans nom)'}{n > 0 ? ` · ${n}` : ''}
                </button>
              )
            })}
          </div>

          <button
            onClick={() => ouvrir({ cible: 'classe' })}
            className="w-full flex items-center justify-center gap-2 bg-alerte hover:bg-alerte/90 text-white font-medium py-3.5 rounded-xl transition active:scale-[0.98] mb-2"
          >
            <Users size={16} /> Arrêter la séance de toute la classe {classeActive}
          </button>
          <p className="text-[11px] text-piste-400 mb-5 text-center">
            Concerne tous les élèves de la classe partis avant l'arrêt, même ceux qui n'apparaissent pas ci-dessous (hors réseau).
          </p>

          {coureurs.length === 0 ? (
            <p className="text-sm text-piste-500">Aucun élève de cette classe n'est en course en ce moment.</p>
          ) : (
            <div className="space-y-2">
              {coureurs.map((p) => {
                const horsLigne = maintenant - p.maj > PRESENCE_HORS_LIGNE_MS
                const recu = !!p.arretRecuTs
                const envoye = !recu && arretsEnvoyes[p.eleveId]
                return (
                  <div key={p.eleveId} className="flex items-center justify-between gap-3 bg-piste-50 rounded-xl px-3.5 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-piste-900 truncate">
                        {p.prenom} {p.nom}
                        {p.binome && <span className="text-piste-500 font-normal"> · avec {p.binome}</span>}
                      </p>
                      <p className="text-[11px] text-piste-500 truncate">
                        {LIBELLE_TYPE[p.type] || 'Course'} · {p.titre}{p.niveauNom ? ` · ${libelleNiveau(p.niveauNom)}` : ''} · {depuis(p.debutTs, maintenant)}
                      </p>
                      {recu ? (
                        <p className="flex items-center gap-1 text-[11px] font-medium text-piste-700 mt-0.5">
                          <CheckCircle2 size={12} /> Arrêt reçu : l'élève termine sa saisie
                        </p>
                      ) : envoye ? (
                        <p className="text-[11px] font-medium text-piste-600 mt-0.5">Arrêt envoyé, en attente de réception…</p>
                      ) : horsLigne ? (
                        <p className="flex items-center gap-1 text-[11px] text-alerte mt-0.5">
                          <WifiOff size={12} /> Signal perdu depuis {depuis(p.maj, maintenant).replace('depuis ', '')}
                        </p>
                      ) : null}
                    </div>
                    {!recu && (
                      <button
                        onClick={() => ouvrir({ cible: 'eleves', eleves: [p] })}
                        className="shrink-0 flex items-center gap-1.5 border-2 border-alerte text-alerte text-xs font-semibold px-3 py-2 rounded-xl hover:bg-[#fbeeea]"
                      >
                        <Hand size={14} /> Arrêter
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {demande && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-lg">
            <div className="flex items-center gap-2 mb-1">
              <Hand size={18} className="text-alerte" />
              <p className="font-display text-lg text-piste-900">Confirmer l'arrêt</p>
            </div>
            <p className="text-sm text-piste-600 mb-4">
              {demande.cible === 'classe'
                ? `Arrêter la séance de toute la classe ${classeActive} (${coureurs.length} élève${coureurs.length > 1 ? 's' : ''} en course visible${coureurs.length > 1 ? 's' : ''}) ?`
                : `Arrêter la séance de ${demande.eleves.map((e) => `${e.prenom} ${e.nom}`).join(', ')} ?`}
            </p>

            <p className="text-[11px] font-semibold text-piste-500 uppercase tracking-wide mb-2">Motif</p>
            <div className="space-y-1.5 mb-3">
              {MOTIFS_ARRET.map((m) => (
                <label key={m.id} className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm cursor-pointer ${motif === m.id ? 'border-piste-800 bg-piste-50' : 'border-piste-200'}`}>
                  <input type="radio" name="motif-arret" checked={motif === m.id} onChange={() => setMotif(m.id)} />
                  {m.label}
                </label>
              ))}
            </div>
            <input
              value={precision}
              onChange={(e) => setPrecision(e.target.value)}
              placeholder={motif === 'autre' ? 'Précise la raison' : 'Précision (facultatif)'}
              className="w-full rounded-xl border border-piste-200 px-3.5 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-piste-500"
            />
            <p className="text-[11px] text-piste-500 mb-4">
              La séance sera notée uniquement sur ce qui a été réalisé, sans pénalité pour ce qui n'a pas pu être couru.
            </p>
            <button
              onClick={confirmerArret}
              disabled={envoi || (motif === 'autre' && !precision.trim())}
              className="w-full flex items-center justify-center gap-2 bg-alerte hover:bg-alerte/90 disabled:opacity-50 text-white font-medium py-3.5 rounded-xl transition mb-2"
            >
              <Hand size={16} /> {envoi ? 'Envoi…' : "Confirmer l'arrêt"}
            </button>
            <button onClick={() => setDemande(null)} className="w-full text-xs text-piste-500 underline py-1">
              Annuler
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
