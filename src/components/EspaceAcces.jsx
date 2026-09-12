import { useState } from 'react'
import { UserPlus, UserX, Eye, EyeOff, ShieldCheck, KeyRound, Pencil, Check, X } from 'lucide-react'
import { storage } from '../utils/storage'

// Réinitialise le PIN d'un collègue existant (son code de synchro ne change pas, donc ses
// classes/élèves/réalisations déjà enregistrés restent intacts) vers un nouveau code choisi
// par l'administrateur.
function ReinitialiserPinCollegue({ collegue, autresPins, onReinitialiser }) {
  const [ouvert, setOuvert] = useState(false)
  const [pin, setPin] = useState('')
  const [erreur, setErreur] = useState('')

  function valider(e) {
    e.preventDefault()
    if (!/^\d{4,6}$/.test(pin)) {
      setErreur('Le code doit contenir de 4 à 6 chiffres.')
      return
    }
    if (autresPins.includes(pin)) {
      setErreur('Ce code est déjà utilisé, choisis-en un autre.')
      return
    }
    onReinitialiser(collegue.id, pin)
    setOuvert(false)
    setPin('')
    setErreur('')
  }

  if (!ouvert) {
    return (
      <button
        onClick={() => setOuvert(true)}
        className="flex items-center gap-1 text-[11px] font-medium text-piste-700 border border-piste-200 rounded-full px-2.5 py-1 hover:bg-white"
      >
        <KeyRound size={12} /> Réinitialiser le PIN
      </button>
    )
  }

  return (
    <form onSubmit={valider} className="flex items-center gap-1.5 flex-wrap">
      <input
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
        inputMode="numeric"
        maxLength={6}
        autoFocus
        placeholder="Nouveau code"
        className="w-28 rounded-lg border border-piste-200 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-piste-500"
      />
      <button type="submit" className="p-1.5 rounded-full bg-piste-800 text-white hover:bg-piste-700">
        <Check size={12} />
      </button>
      <button type="button" onClick={() => { setOuvert(false); setPin(''); setErreur('') }} className="p-1.5 rounded-full border border-piste-200 text-piste-600 hover:bg-piste-50">
        <X size={12} />
      </button>
      {erreur && <p className="text-alerte text-[11px] w-full">{erreur}</p>}
    </form>
  )
}

// Nom affiché de l'administrateur, modifiable : c'est ce nom que les élèves voient dans la
// liste des professeurs à la connexion. Civilité (Mr/Mme) + nom séparés à la saisie, mais
// stockés comme un seul texte ("Mr Guilhem").
function NomAdmin({ nomAdmin, onChanger }) {
  const [edition, setEdition] = useState(false)
  const decompose = (valeur) => {
    const m = /^(Mr|Mme)\s+(.*)$/.exec(valeur || '')
    return m ? { civilite: m[1], nom: m[2] } : { civilite: 'Mr', nom: valeur || '' }
  }
  const [civilite, setCivilite] = useState(() => decompose(nomAdmin).civilite)
  const [valeur, setValeur] = useState(() => decompose(nomAdmin).nom)

  function valider(e) {
    e.preventDefault()
    if (!valeur.trim()) return
    onChanger(`${civilite} ${valeur.trim()}`)
    setEdition(false)
  }

  if (!edition) {
    return (
      <button onClick={() => { const d = decompose(nomAdmin); setCivilite(d.civilite); setValeur(d.nom); setEdition(true) }} className="flex items-center gap-1.5 text-xs text-piste-600 hover:text-piste-900 mb-2.5">
        <Pencil size={12} /> Nom affiché aux élèves : <span className="font-medium text-piste-900">{nomAdmin}</span>
      </button>
    )
  }

  return (
    <form onSubmit={valider} className="flex items-center gap-2 mb-2.5">
      <select
        value={civilite}
        onChange={(e) => setCivilite(e.target.value)}
        className="rounded-lg border border-piste-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-piste-500"
      >
        <option value="Mr">Mr</option>
        <option value="Mme">Mme</option>
      </select>
      <input
        value={valeur}
        onChange={(e) => setValeur(e.target.value)}
        autoFocus
        className="flex-1 rounded-lg border border-piste-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-piste-500"
      />
      <button type="submit" className="p-1.5 rounded-full bg-piste-800 text-white hover:bg-piste-700"><Check size={13} /></button>
      <button type="button" onClick={() => setEdition(false)} className="p-1.5 rounded-full border border-piste-200 text-piste-600"><X size={13} /></button>
    </form>
  )
}

function ChangerPinAdmin({ pinActuel, onChanger }) {
  const [edition, setEdition] = useState(false)
  const [pin, setPin] = useState('')
  const [erreur, setErreur] = useState('')

  function valider(e) {
    e.preventDefault()
    if (!/^\d{4,6}$/.test(pin)) {
      setErreur('Le code doit contenir de 4 à 6 chiffres.')
      return
    }
    onChanger(pin)
    setEdition(false)
    setPin('')
  }

  if (!edition) {
    return (
      <button onClick={() => setEdition(true)} className="flex items-center gap-1.5 text-xs text-piste-600 hover:text-piste-900">
        <KeyRound size={12} /> Code d'accès : <span className="font-medium text-piste-900">{pinActuel}</span> · modifier
      </button>
    )
  }

  return (
    <form onSubmit={valider} className="flex items-center gap-2">
      <input
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
        inputMode="numeric"
        maxLength={6}
        autoFocus
        placeholder="Nouveau code"
        className="w-32 rounded-lg border border-piste-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-piste-500"
      />
      <button type="submit" className="p-1.5 rounded-full bg-piste-800 text-white hover:bg-piste-700"><Check size={13} /></button>
      <button type="button" onClick={() => setEdition(false)} className="p-1.5 rounded-full border border-piste-200 text-piste-600"><X size={13} /></button>
      {erreur && <p className="text-alerte text-[11px]">{erreur}</p>}
    </form>
  )
}

// accesConfig: { pinAdmin, nomAdmin, adminCode, collegues: [{ id, nom, pin, code }] }
export default function EspaceAcces({ accesConfig, onSauver }) {
  const [civilite, setCivilite] = useState('Mr')
  const [nom, setNom] = useState('')
  const [pin, setPin] = useState('')
  const [erreur, setErreur] = useState('')
  const [pinVisible, setPinVisible] = useState(null)

  const collegues = accesConfig.collegues || []

  function ajouter(e) {
    e.preventDefault()
    setErreur('')
    if (!nom.trim()) {
      setErreur('Indique le nom du collègue.')
      return
    }
    if (!/^\d{4,6}$/.test(pin)) {
      setErreur('Le code doit contenir de 4 à 6 chiffres.')
      return
    }
    const dejaPris = pin === accesConfig.pinAdmin || collegues.some((c) => c.pin === pin)
    if (dejaPris) {
      setErreur('Ce code est déjà utilisé, choisis-en un autre.')
      return
    }
    const nouveauCollegue = { id: crypto.randomUUID ? crypto.randomUUID() : `c_${Date.now()}`, nom: `${civilite} ${nom.trim()}`, pin, code: storage.genererCode() }
    onSauver({ ...accesConfig, collegues: [...collegues, nouveauCollegue] })
    setNom('')
    setPin('')
  }

  function supprimer(c) {
    if (!confirm(`Retirer l'accès de ${c.nom} ? Son code (${c.pin}) ne fonctionnera plus. Ses classes, élèves et réalisations déjà enregistrés seront conservés mais ne seront plus accessibles que depuis "Vue globale".`)) return
    onSauver({ ...accesConfig, collegues: collegues.filter((x) => x.id !== c.id) })
  }

  function reinitialiserPin(id, nouveauPin) {
    onSauver({ ...accesConfig, collegues: collegues.map((c) => (c.id === id ? { ...c, pin: nouveauPin } : c)) })
  }

  return (
    <section>
      <div className="bg-white border border-piste-200 rounded-xl p-3.5 mb-5">
        <div className="flex items-center gap-2 mb-2.5">
          <ShieldCheck size={15} className="text-piste-500" />
          <p className="text-sm font-medium text-piste-800">Mon accès (administrateur)</p>
        </div>
        <NomAdmin nomAdmin={accesConfig.nomAdmin} onChanger={(n) => onSauver({ ...accesConfig, nomAdmin: n })} />
        <ChangerPinAdmin pinActuel={accesConfig.pinAdmin} onChanger={(p) => onSauver({ ...accesConfig, pinAdmin: p })} />
      </div>

      <h3 className="text-xs font-semibold tracking-wide text-piste-500 uppercase mb-3">Collègues autorisés</h3>
      <p className="text-xs text-piste-500 mb-3">
        Attribue un code personnel à chaque collègue pour qu'il utilise l'appli avec ses propres classes.
        Chacun a sa propre base (classes, élèves, réalisations, VMA, bibliothèque de séances), totalement
        séparée de la tienne et de celle des autres. Toi seul peux consulter l'espace d'un collègue,
        depuis "Vue globale".
      </p>

      <form onSubmit={ajouter} className="flex flex-col sm:flex-row gap-2 mb-4">
        <select
          value={civilite}
          onChange={(e) => setCivilite(e.target.value)}
          className="rounded-lg border border-piste-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-piste-500"
        >
          <option value="Mr">Mr</option>
          <option value="Mme">Mme</option>
        </select>
        <input
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          placeholder="Nom du collègue"
          className="flex-1 rounded-lg border border-piste-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-piste-500"
        />
        <input
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
          inputMode="numeric"
          maxLength={6}
          placeholder="Code PIN (4 à 6 chiffres)"
          className="sm:w-52 rounded-lg border border-piste-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-piste-500"
        />
        <button type="submit" className="flex items-center justify-center gap-1.5 bg-piste-800 hover:bg-piste-700 text-white text-sm font-medium px-3.5 py-2 rounded-lg transition">
          <UserPlus size={14} /> Ajouter
        </button>
      </form>
      {erreur && <p className="text-alerte text-xs mb-3 -mt-2">{erreur}</p>}

      {collegues.length === 0 ? (
        <p className="text-sm text-piste-500">Aucun collègue ajouté pour l'instant.</p>
      ) : (
        <div className="space-y-2">
          {collegues.map((c) => (
            <div key={c.id} className="flex items-center justify-between bg-piste-50 rounded-xl px-3.5 py-2.5 gap-2 flex-wrap">
              <div>
                <p className="text-sm font-medium text-piste-900">{c.nom}</p>
                <button
                  onClick={() => setPinVisible(pinVisible === c.id ? null : c.id)}
                  className="flex items-center gap-1 text-xs text-piste-500 hover:text-piste-700 mt-0.5"
                >
                  {pinVisible === c.id ? <EyeOff size={12} /> : <Eye size={12} />}
                  Code : {pinVisible === c.id ? c.pin : '••••'}
                </button>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <ReinitialiserPinCollegue
                  collegue={c}
                  autresPins={[accesConfig.pinAdmin, ...collegues.filter((x) => x.id !== c.id).map((x) => x.pin)]}
                  onReinitialiser={reinitialiserPin}
                />
                <button
                  onClick={() => supprimer(c)}
                  className="flex items-center gap-1 text-[11px] font-medium text-alerte border border-[#f0d3ca] rounded-full px-2.5 py-1 hover:bg-white"
                >
                  <UserX size={12} /> Retirer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
