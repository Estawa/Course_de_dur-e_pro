# Course de Durée Pro by C. Guilhem

Application de gestion des séances de course de durée en EPS : identification élève/classe, choix de niveaux de course, guidage GPS ou minuteur pendant l'effort, bilan noté, et suivi de cycle côté enseignant.

## Installation locale

```bash
npm install
npm run dev
```

L'application s'ouvre sur http://localhost:5173

## Build de production

```bash
npm run build
```

Le dossier `dist/` généré est prêt à être déployé (Vercel, Netlify, etc.).

## Déploiement conseillé (comme les autres applis)

1. Créer un dépôt GitHub (ex. `Estawa/course-duree-pro`) et y pousser ce code
2. Importer le dépôt dans Vercel (ou lier via la CLI Vercel : `vercel login` puis `vercel`)
3. Vercel détecte automatiquement Vite et déploie

## Code PIN enseignant

Le code d'accès par défaut à l'espace enseignant est `2024` (à modifier dans `src/utils/storage.js`, constante `PIN_ENSEIGNANT`, avant déploiement définitif).

## Notes

- Les données (roster, séances, réalisations) sont stockées en local (localStorage) sur l'appareil utilisé. Pour un usage multi-appareils synchronisé, une évolution vers Firebase/Firestore est possible (comme sur les autres applications de C. Guilhem).
- Le mode GPS nécessite l'autorisation de géolocalisation du navigateur/téléphone.
