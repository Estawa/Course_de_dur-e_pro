import { useEffect, useRef } from 'react'

// Empêche l'écran de s'éteindre tant que `actif` est vrai (API Screen Wake Lock, supportée par
// Chrome Android/desktop). Le verrou est automatiquement relâché par le navigateur quand l'onglet
// passe en arrière-plan (écran verrouillé, changement d'appli) : on le redemande dès que l'onglet
// redevient visible, tant que `actif` reste vrai. Sans effet (silencieux) sur les navigateurs qui
// ne supportent pas l'API — l'écran pourra alors s'éteindre normalement sur ces appareils.
export function useWakeLock(actif) {
  const lockRef = useRef(null)

  useEffect(() => {
    if (!actif) return
    if (!('wakeLock' in navigator)) return

    let annule = false

    async function demander() {
      try {
        const lock = await navigator.wakeLock.request('screen')
        if (annule) {
          lock.release().catch(() => {})
          return
        }
        lockRef.current = lock
      } catch {
        // Refusé (ex. onglet pas encore visible) : sans conséquence, on retentera à la visibilité
      }
    }

    function surVisibilite() {
      if (document.visibilityState === 'visible' && !lockRef.current) demander()
    }

    demander()
    document.addEventListener('visibilitychange', surVisibilite)

    return () => {
      annule = true
      document.removeEventListener('visibilitychange', surVisibilite)
      if (lockRef.current) {
        lockRef.current.release().catch(() => {})
        lockRef.current = null
      }
    }
  }, [actif])
}
