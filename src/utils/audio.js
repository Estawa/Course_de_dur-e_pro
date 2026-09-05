let ctx = null

function getCtx() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)()
  }
  return ctx
}

export function beep({ freq = 880, duration = 0.12, volume = 0.3, type = 'sine' } = {}) {
  try {
    const audioCtx = getCtx()
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    osc.type = type
    osc.frequency.value = freq
    gain.gain.value = volume
    osc.connect(gain)
    gain.connect(audioCtx.destination)
    osc.start()
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration)
    osc.stop(audioCtx.currentTime + duration + 0.02)
  } catch (e) {
    // silence si audio indisponible
  }
}

export function beepDepart() {
  beep({ freq: 660, duration: 0.15, type: 'square' })
}

export function beepFin() {
  beep({ freq: 220, duration: 0.25, type: 'square' })
  setTimeout(() => beep({ freq: 220, duration: 0.25, type: 'square' }), 220)
}

// Bip de régulation d'allure : plus l'élève est loin de la cible, plus les bips sont rapprochés.
// ecartPct : écart relatif à la vitesse cible (0 = pile dedans)
export function planifierBipRegulation(ecartPct, callback) {
  const ecartAbs = Math.min(Math.abs(ecartPct), 1)
  if (ecartAbs < 0.05) return null // dans la zone verte, pas de bip
  const intervalle = 1800 - ecartAbs * 1500 // entre ~300ms et 1800ms
  return setTimeout(() => {
    beep({ freq: ecartPct > 0 ? 1100 : 500, duration: 0.08, volume: 0.22 })
    callback()
  }, Math.max(250, intervalle))
}

export function gongTransition() {
  beep({ freq: 500, duration: 0.18, volume: 0.35, type: 'triangle' })
  setTimeout(() => beep({ freq: 700, duration: 0.18, volume: 0.35, type: 'triangle' }), 200)
}

export function bipTopPassage() {
  beep({ freq: 900, duration: 0.1, volume: 0.35 })
}

// Annonce vocale d'une transition de phase (échauffement, départ, récupération...).
// Silencieux si la synthèse vocale n'est pas disponible sur l'appareil.
export function annoncerVocal(texte) {
  try {
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(texte)
    utterance.lang = 'fr-FR'
    utterance.rate = 1.05
    window.speechSynthesis.speak(utterance)
  } catch (e) {
    // silence si la synthèse vocale échoue
  }
}
