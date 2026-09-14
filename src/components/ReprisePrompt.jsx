// Écran affiché quand une activité (test, Fartlek) a été interrompue par une fermeture/mise en
// veille prolongée de l'appli, avant que l'élève ait choisi de reprendre ou de recommencer.
export default function ReprisePrompt({ titre, onReprendre, onIgnorer }) {
  return (
    <div className="max-w-md mx-auto px-6 py-16 text-center">
      <p className="font-display text-lg text-piste-900 mb-2">Interrompu</p>
      <p className="text-sm text-piste-600 mb-8">
        {titre} était en cours et s'est arrêté avant la fin. Veux-tu reprendre là où tu en étais ?
      </p>
      <button
        onClick={onReprendre}
        className="w-full bg-piste-800 hover:bg-piste-700 text-white font-medium py-3 rounded-xl transition active:scale-[0.98] mb-3"
      >
        Reprendre
      </button>
      <button onClick={onIgnorer} className="text-xs text-piste-400 underline">
        Non, recommencer
      </button>
    </div>
  )
}
