# Cloudflare Worker — proxy Albion Gameinfo

Ce Worker sert de proxy CORS entre GitHub Pages et l'API Gameinfo Europe d'Albion Online.

## Configuration utilisée

- Site autorisé : https://lemax-al.github.io
- URL du Worker attendue par le site : https://site-albion-v2.maxbruneteau.workers.dev
- API amont : https://gameinfo-ams.albiononline.com/api/gameinfo/

Le site appelle le Worker avec le préfixe `/api`, par exemple :
`/api/search?q=LeMax`, `/api/players/{id}/kills?limit=20`.

## Déploiement

1. Dans Cloudflare, ouvre **Workers & Pages** puis le Worker `site-albion-v2`.
2. Ouvre **Edit code**.
3. Remplace le contenu par `index.js` de ce dossier.
4. Clique sur **Deploy**.

Le nom du Worker doit rester `site-albion-v2` pour correspondre à l'URL configurée dans `app.js`.

## CORS et sécurité

Le Worker accepte uniquement l'origine exacte `https://lemax-al.github.io`, les méthodes GET/OPTIONS et les routes `search`, `players` et `events`. L'origine ne contient pas le chemin du projet GitHub Pages.

Une visite directe de l'URL du Worker dans la barre d'adresse peut répondre 403, car elle n'envoie pas l'en-tête Origin attendu. Le test pertinent est de charger le site GitHub Pages.

## Vérification

Après déploiement, recharge :
https://lemax-al.github.io/Site-Albion-V2/

Dans les outils développeur du navigateur, les appels réseau Gameinfo doivent viser :
`site-albion-v2.maxbruneteau.workers.dev/api/...`
et non directement `gameinfo-ams.albiononline.com`.
