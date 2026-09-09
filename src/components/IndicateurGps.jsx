// Même indicateur que celui utilisé sur l'écran d'attente du test VAM-EVAL, réutilisé par
// tous les tests VMA : vert = GPS actif, rouge = GPS inactif, gris pulsant = recherche en cours.
export default function IndicateurGps({ gpsOk, className = '' }) {
  return (
    <div className={className}>
      <div
        className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ${
          gpsOk === true
            ? 'bg-piste-50 text-piste-700 border border-piste-300'
            : gpsOk === false
            ? 'bg-[#fbeeea] text-alerte border border-alerte/50'
            : 'bg-piste-50 text-piste-500 border border-piste-200'
        }`}
      >
        <span
          className={`w-2.5 h-2.5 rounded-full ${
            gpsOk === true ? 'bg-piste-600' : gpsOk === false ? 'bg-alerte' : 'bg-piste-300 animate-pulse'
          }`}
        />
        {gpsOk === true && 'GPS actif'}
        {gpsOk === false && 'GPS inactif'}
        {gpsOk === null && 'Recherche du GPS…'}
      </div>
      {gpsOk === false && (
        <p className="text-xs text-alerte mt-2">
          Vérifie que la localisation est autorisée pour l'appli. Sans GPS, ta distance devra être saisie à la main.
        </p>
      )}
    </div>
  )
}
