# Déploiement Cloudflare

Le fichier `app.js` utilise désormais le proxy :
`https://site-albion-v2.maxbruneteau.workers.dev/api`

Pour que les données chargent, le Worker Cloudflare doit être déployé avec le code situé dans `cloudflare-worker/index.js`.

Étapes :
1. Cloudflare Dashboard → Workers & Pages → `site-albion-v2` → Edit code.
2. Copier le contenu de `cloudflare-worker/index.js` dans l'éditeur.
3. Cliquer sur Deploy.
4. Ouvrir https://lemax-al.github.io/Site-Albion-V2/ et vérifier que le profil et les événements chargent.

CORS est limité à l'origine `https://lemax-al.github.io` (sans le chemin `/Site-Albion-V2/`).
