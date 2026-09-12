import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { Footprints, Lock, Copy, Check, Share2, ChevronRight } from 'lucide-react'
import { storage } from '../utils/storage'

function PartagerApp() {
  const canvasRef = useRef(null)
  const [ouvert, setOuvert] = useState(false)
  const [lien, setLien] = useState('')
  const [copie, setCopie] = useState(false)

  useEffect(() => {
    if (!ouvert) return
    // Lien de l'appli avec le code de synchro embarqué, pour que l'élève rejoigne
    // automatiquement le même espace cloud que le prof (voir utils/cloud.js).
    const base = window.location.origin + window.location.pathname
    const code = storage.cloudDisponible() ? storage.assurerCodeSync() : ''
    const url = code ? `${base}?c=${encodeURIComponent(code)}` : base
    setLien(url)
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, url, {
        width: 180,
        margin: 1,
        color: { dark: '#1c2b21', light: '#ffffff' }
      })
    }
  }, [ouvert])

  function copierLien() {
    navigator.clipboard.writeText(lien).then(() => {
      setCopie(true)
      setTimeout(() => setCopie(false), 2000)
    })
  }

  function partagerLien() {
    if (navigator.share) {
      navigator.share({ title: 'Course de Durée Pro', url: lien }).catch(() => {})
    } else {
      copierLien()
    }
  }

  return (
    <div className="max-w-md mx-auto mb-4 bg-white border border-piste-200 rounded-xl p-3.5">
      <button type="button" onClick={() => setOuvert((o) => !o)} className="w-full flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-piste-50 flex items-center justify-center">
            <Share2 size={14} className="text-piste-500" />
          </div>
          <p className="text-sm font-medium text-piste-800">Partager l'appli</p>
        </div>
        <ChevronRight size={16} className={`text-piste-400 transition ${ouvert ? 'rotate-90' : ''}`} />
      </button>

      {ouvert && (
        <div className="mt-4 flex flex-col items-center gap-3">
          <div className="bg-white p-2.5 rounded-xl border border-piste-100">
            <canvas ref={canvasRef} />
          </div>
          <p className="text-xs text-piste-500 text-center break-all px-2">{lien}</p>
          <button type="button" onClick={partagerLien} className="w-full bg-piste-800 text-white text-xs font-medium rounded-lg py-2.5 flex items-center justify-center gap-1.5">
            <Share2 size={13} /> Partager le lien
          </button>
          <button type="button" onClick={copierLien} className="w-full bg-piste-50 text-piste-700 text-xs font-medium rounded-lg py-2.5 flex items-center justify-center gap-1.5">
            {copie ? <><Check size={13} /> Lien copié</> : <><Copy size={13} /> Copier le lien</>}
          </button>
          <p className="text-[10px] text-piste-400 text-center">Fais scanner ce code, ou transmets le lien pour que chaque élève ouvre l'appli connectée à la même classe.</p>
        </div>
      )}
    </div>
  )
}

function LienEnseignant({ onAccesEnseignant }) {
  if (!onAccesEnseignant) return null
  return (
    <button
      type="button"
      onClick={onAccesEnseignant}
      className="w-full max-w-md mx-auto mb-8 block text-center border border-piste-200 rounded-xl py-3 text-sm text-piste-700"
    >
      Tu es professeur ? <span className="font-medium">Connexion ici →</span>
    </button>
  )
}

// Tout se passe sur UNE SEULE page (comme Muscu Pro / Escalade Pro) : classe, nom et code
// PIN s'enchaînent verticalement au fur et à mesure des choix, sans changement d'écran.
// Course de Durée Pro n'a qu'un seul professeur : pas de sélection de professeur ici.
export default function EleveLogin({ onConnecte, onAccesEnseignant }) {
  const [classes] = useState(() => storage.getClasses())
  const aDesClasses = classes.length > 0

  const [classe, setClasse] = useState('')
  const [eleveId, setEleveId] = useState('')
  const [prenomManuel, setPrenomManuel] = useState('')
  const [nomManuel, setNomManuel] = useState('')
  const [classeManuelle, setClasseManuelle] = useState('')
  const [pin, setPin] = useState('')
  const [pinConfirm, setPinConfirm] = useState('')
  const [erreur, setErreur] = useState('')

  const eleves = classe ? storage.getElevesClasse(classe) : []
  const eleveSelectionne = eleveId ? storage.trouverEleve(classe, eleveId) : null
  const premierePinEnCours = !!eleveSelectionne && !eleveSelectionne.pin

  const identitePrete = aDesClasses
    ? !!eleveId
    : (prenomManuel.trim() && nomManuel.trim() && classeManuelle.trim())

  function choisirClasse(c) {
    setClasse(c)
    setEleveId('')
    setErreur('')
  }

  function choisirEleve(id) {
    setEleveId(id)
    setPin('')
    setPinConfirm('')
    setErreur('')
  }

  function connecterAvec(id, classeConnexion) {
    const eleve = storage.trouverEleve(classeConnexion, id)
    storage.setEleveActifId(id)
    onConnecte({ id: eleve.id, nom: eleve.nom, prenom: eleve.prenom, classe: classeConnexion })
  }

  function valider(e) {
    e.preventDefault()
    if (!/^\d{4,6}$/.test(pin)) {
      setErreur('Choisis un code à 4 chiffres minimum.')
      return
    }

    if (aDesClasses) {
      if (premierePinEnCours) {
        if (pin !== pinConfirm) {
          setErreur('Les deux codes ne correspondent pas.')
          setPinConfirm('')
          return
        }
        storage.definirPin(classe, eleveId, pin)
        connecterAvec(eleveId, classe)
      } else if (storage.verifierPin(classe, eleveId, pin)) {
        connecterAvec(eleveId, classe)
      } else {
        setErreur('Code incorrect.')
        setPin('')
      }
    } else {
      if (pin !== pinConfirm) {
        setErreur('Les deux codes ne correspondent pas.')
        setPinConfirm('')
        return
      }
      const classeSaisie = classeManuelle.trim().toUpperCase()
      const eleve = storage.ajouterEleveManuel(classeSaisie, nomManuel.trim(), prenomManuel.trim())
      storage.definirPin(classeSaisie, eleve.id, pin)
      connecterAvec(eleve.id, classeSaisie)
    }
  }

  return (
    <div className="max-w-md mx-auto px-6 py-10">
      <PartagerApp />
      <LienEnseignant onAccesEnseignant={onAccesEnseignant} />

      <div className="flex flex-col items-center text-center mb-8">
        <div className="w-16 h-16 rounded-2xl bg-piste-800 flex items-center justify-center mb-4">
          <Footprints className="text-piste-200" size={30} />
        </div>
        <h2 className="font-display text-2xl text-piste-900">Qui es-tu ?</h2>
        <p className="text-piste-600 text-sm mt-1">Pour que ton professeur puisse suivre ta progression.</p>
      </div>

      {erreur && <p className="text-alerte text-sm text-center mb-4">{erreur}</p>}

      <form onSubmit={valider} className="space-y-4">
        {aDesClasses ? (
          <>
            <div>
              <label className="block text-sm font-medium text-piste-800 mb-1">Ta classe</label>
              <select
                value={classe}
                onChange={(e) => choisirClasse(e.target.value)}
                className="w-full bg-white border-2 border-piste-100 focus:border-piste-500 rounded-xl px-4 py-3.5 font-medium text-piste-900 transition focus:outline-none"
              >
                <option value="" disabled>Sélectionne ta classe...</option>
                {classes.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {classe && (
              <div>
                <label className="block text-sm font-medium text-piste-800 mb-1">Ton nom</label>
                <select
                  value={eleveId}
                  onChange={(e) => choisirEleve(e.target.value)}
                  className="w-full bg-white border-2 border-piste-100 focus:border-piste-500 rounded-xl px-4 py-3.5 font-medium text-piste-900 transition focus:outline-none"
                >
                  <option value="" disabled>Sélectionne ton nom...</option>
                  {eleves.map((el) => (
                    <option key={el.id} value={el.id}>{el.prenom} {el.nom}</option>
                  ))}
                </select>
                {eleves.length === 0 && (
                  <p className="text-xs text-piste-400 mt-1">Aucun élève enregistré dans cette classe pour l'instant.</p>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            <div>
              <label className="block text-sm font-medium text-piste-800 mb-1">Prénom</label>
              <input
                value={prenomManuel}
                onChange={(e) => setPrenomManuel(e.target.value)}
                className="w-full rounded-xl border border-piste-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-piste-500"
                placeholder="Ex : Léo"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-piste-800 mb-1">Nom</label>
              <input
                value={nomManuel}
                onChange={(e) => setNomManuel(e.target.value)}
                className="w-full rounded-xl border border-piste-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-piste-500"
                placeholder="Ex : Martin"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-piste-800 mb-1">Classe</label>
              <input
                value={classeManuelle}
                onChange={(e) => setClasseManuelle(e.target.value)}
                className="w-full rounded-xl border border-piste-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-piste-500"
                placeholder="Ex : 2NDE4"
              />
            </div>
          </>
        )}

        {identitePrete && (
          <div className="pt-2 space-y-3">
            <div className="flex items-center gap-2">
              <Lock size={14} className="text-piste-500" />
              <p className="text-sm font-medium text-piste-800">
                {aDesClasses && !premierePinEnCours ? 'Ton code PIN personnel' : 'Choisis ton code PIN personnel'}
              </p>
            </div>
            <input
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              className={`w-full text-center text-2xl tracking-[0.5em] rounded-xl border-2 px-4 py-3 focus:outline-none ${erreur ? 'border-alerte' : 'border-piste-200 focus:border-piste-500'}`}
              maxLength={6}
              placeholder="••••"
            />
            {(!aDesClasses || premierePinEnCours) && (
              <input
                type="password"
                inputMode="numeric"
                value={pinConfirm}
                onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, ''))}
                className="w-full text-center text-2xl tracking-[0.5em] rounded-xl border-2 border-piste-200 focus:border-piste-500 px-4 py-3 focus:outline-none"
                maxLength={6}
                placeholder="Confirme le code"
              />
            )}
          </div>
        )}

        {identitePrete && (
          <button
            type="submit"
            className="w-full bg-piste-800 hover:bg-piste-700 text-white font-medium py-3.5 rounded-xl transition active:scale-[0.98]"
          >
            Commencer
          </button>
        )}
      </form>
    </div>
  )
}
