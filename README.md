# LeMax Killboard — Europe

Site personnel HTML/CSS/JavaScript dédié au personnage exact **LeMax** sur le serveur **Europe**.

## Lancer
1. Décompressez l'archive.
2. Ouvrez `index.html` avec Live Server (VS Code conseillé).
3. Le site recherche automatiquement `LeMax` sur Gameinfo Europe et charge profil, kills et morts.

## API
- Gameinfo Europe : `https://gameinfo-ams.albiononline.com/api/gameinfo`
- Recherche : `/search?q=LeMax`
- Profil : `/players/{id}`
- Kills / morts : `/players/{id}/kills` et `/players/{id}/deaths`
- Détail : `/events/{eventId}`
- Images : `https://render.albiononline.com/v1/item/{UniqueName}.png`

Le site refuse de choisir au hasard si plusieurs personnages exacts nommés LeMax sont renvoyés. L'API Gameinfo est publique, non officiellement documentée et son historique est limité. Si le navigateur bloque les requêtes directes (CORS), il faudra ajouter un proxy backend.
