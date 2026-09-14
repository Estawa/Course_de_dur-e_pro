import { useState } from 'react'
import { UserPlus, UserX, Eye, EyeOff, ShieldCheck, KeyRound, Pencil, Check, X, DownloadCloud } from 'lucide-react'
import ChangerPin from './ChangerPin'

// Formulaire de migration depuis l'ancienne version (un seul professeur, "code de synchro").
// N'apparaît que côté administrateur, une fois : recopie classes/élèves/séances réalisées/VMA
// de l'ancien espace vers l'espace actuel (fusion, sans écraser ni dupliquer — voir
// storage.migrerAncienEspace).
function MigrationAncienneVersion({ onMigrer }) {
  const [ouvert, setOuvert] = useState(false)
  const [code, setCode] = useState('')
  const [enCours, setEnCours] = useState(false)
  const [resultat, setResultat] = useState(null)
  const [erreur, setErreur] = useState('')

  async function valider(e) {
    e.preventDefault()
    if (!code.trim()) return
    setErreur('')
    setResultat(null)
    setEnCours(true)
    try {
      const res = await onMigrer(code.trim().toUpperCase())
      setResultat(res)
    } catch (e2) {
      setErreur(e2.message || 'Échec de la migration.')
    } finally {
      setEnCours(false)
    }
  }

  if (!ouvert) {
    return (
      <button
        onClick={() => setOuvert(true)}
        className="flex items-center gap-1.5 text-xs font-medium text-piste-600 hover:text-piste-900"
      >
        <DownloadCloud size={13} /> Récupérer mes données de l'ancienne version
      </button>
    )
  }

  return (
    <div className="bg-piste-50 border border-piste-200 rounded-xl p-3.5">
      <p className="text-xs font-semibold text-piste-700 uppercase tracking-wide mb-1.5">
        Migration depuis l'ancienne version
      </p>
      <p className="text-xs text-piste-500 mb-3">
        Entre le code de synchro affiché par l'ancienne version de l'appli (visible sur l'ancien
        écran "Espace enseignant" : <em>Synchronisation active — code « ... »</em>). Tes classes,
        élèves, séances réalisées, résultats de tests VMA et séances de bibliothèque seront
        recopiés dans ton espace actuel, sans rien dupliquer si tu relances l'opération.
      </p>
      <form onSubmit={valider} className="flex flex-col sm:flex-row gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Ancien code (ex : A1B2C3)"
          className="flex-1 rounded-lg border border-piste-200 px-3 py-2 text-sm font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-piste-500"
        />
        <button
          type="submit"
          disabled={enCours || !code.trim()}
          className="flex items-center justify-center gap-1.5 bg-piste-800 hover:bg-piste-700 disabled:opacity-50 text-white text-sm font-medium px-3.5 py-2 rounded-lg transition"
        >
          {enCours ? 'Migration en cours...' : 'Migrer'}
        </button>
      </form>
      {erreur && <p className="text-alerte text-xs mt-2">{erreur}</p>}
      {resultat && (
        <p className="text-xs text-piste-700 mt-2">
          Terminé : {resultat.nbClasses} classe(s), {resultat.nbEleves} élève(s) et {resultat.nbRealisations} séance(s)
          réalisée(s) récupérées (les résultats de tests VMA et la bibliothèque de séances ont
          aussi été recopiés s'ils n'existaient pas déjà ici).
        </p>
      )}
    </div>
  )
}

// Réinitialise le PIN d'un collègue existant (l'id/teacherId ne change pas, donc ses classes
// et son suivi déjà enregistrés restent intacts) vers un nouveau code choisi par l'admin.
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

// Nom affiché de l'administrateur (Christophe), modifiable : c'est ce nom que les élèves
// voient dans la liste des professeurs à la connexion.
function NomAdmin({ nomAdmin, onChanger }) {
  const [edition, setEdition] = useState(false)
  const [valeur, setValeur] = useState(nomAdmin || '')

  function valider(e) {
    e.preventDefault()
    if (!valeur.trim()) return
    onChanger(valeur.trim())
    setEdition(false)
  }

  if (!edition) {
    return (
      <button onClick={() => { setValeur(nomAdmin || ''); setEdition(true) }} className="flex items-center gap-1.5 text-xs text-piste-600 hover:text-piste-900 mb-2.5">
        <Pencil size={12} /> Nom affiché aux élèves : <span className="font-medium text-piste-900">{nomAdmin}</span>
      </button>
    )
  }

  return (
    <form onSubmit={valider} className="flex items-center gap-2 mb-2.5">
      <input
        value={valeur}
        onChange={(e) => setValeur(e.target.value)}
        autoFocus
        placeholder="Ex : Mr Guilhem"
        className="flex-1 rounded-lg border border-piste-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-piste-500"
      />
      <button type="submit" className="p-1.5 rounded-full bg-piste-800 text-white hover:bg-piste-700"><Check size={13} /></button>
      <button type="button" onClick={() => setEdition(false)} className="p-1.5 rounded-full border border-piste-200 text-piste-600"><X size={13} /></button>
    </form>
  )
}

// accesConfig: { pinAdmin, nomAdmin, collegues: [{ id, nom, pin }] }
// onChangerPinAdmin(nouveauPin), onChangerNomAdmin(nom), onAjouterCollegue(nom, pin),
// onSupprimerCollegue(id), onReinitialiserPinCollegue(id, nouveauPin)
export default function EspaceAcces({ accesConfig, onChangerPinAdmin, onChangerNomAdmin, onAjouterCollegue, onSupprimerCollegue, onReinitialiserPinCollegue, onMigrer }) {
  const [nom, setNom] = useState('')
  const [pin, setPin] = useState('')
  const [erreur, setErreur] = useState('')
  const [pinVisible, setPinVisible] = useState(null) // id du collègue dont le PIN est affiché en clair

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
    onAjouterCollegue(nom.trim(), pin)
    setNom('')
    setPin('')
  }

  function supprimer(c) {
    if (!confirm(`Retirer l'accès de ${c.nom} ? Son code (${c.pin}) ne fonctionnera plus. Ses classes et son suivi déjà enregistrés seront conservés mais ne seront plus accessibles que depuis "Vue globale".`)) return
    onSupprimerCollegue(c.id)
  }

  return (
    <section>
      <div className="bg-white border border-piste-200 rounded-xl p-3.5 mb-5">
        <div className="flex items-center gap-2 mb-2.5">
          <ShieldCheck size={15} className="text-piste-500" />
          <p className="text-sm font-medium text-piste-800">Mon accès (administrateur)</p>
        </div>
        <p className="text-xs text-piste-500 mb-2.5">
          Seul ton code donne accès à la gestion des accès (cet onglet) et à la Vue globale.
        </p>
        <NomAdmin nomAdmin={accesConfig.nomAdmin} onChanger={onChangerNomAdmin} />
        <ChangerPin pinActuel={accesConfig.pinAdmin} onChanger={onChangerPinAdmin} />
        {onMigrer && (
          <div className="mt-3 pt-3 border-t border-piste-100">
            <MigrationAncienneVersion onMigrer={onMigrer} />
          </div>
        )}
      </div>

      <h3 className="text-xs font-semibold tracking-wide text-piste-500 uppercase mb-3">Collègues autorisés</h3>
      <p className="text-xs text-piste-500 mb-3">
        Attribue un code personnel à chaque collègue pour qu'il utilise l'appli avec ses propres classes.
        Chacun a sa propre base d'élèves et de suivi, séparée de celle des autres et de la tienne.
      </p>

      <form onSubmit={ajouter} className="flex flex-col sm:flex-row gap-2 mb-4">
        <input
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          placeholder="Nom du collègue (ex : Mme Dubreuil)"
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
                  onReinitialiser={onReinitialiserPinCollegue}
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
