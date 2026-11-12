# Albion Killboard — HTML / CSS / JavaScript

## Lancer le projet
1. Décompresse `albion-killboard.zip`.
2. Ouvre le dossier dans VS Code.
3. Lance `index.html` avec l'extension **Live Server** (recommandé), ou avec un serveur statique local.
4. Choisis le serveur (Europe / Americas / Asia), colle l'ID d'un kill puis clique sur **Afficher le kill**.

## API utilisées
- Gameinfo : `https://gameinfo-ams.albiononline.com/api/gameinfo/events/{eventId}` (Europe)
- Render : `https://render.albiononline.com/v1/item/{UniqueName}.png?quality=1&size=128`

Les hôtes Gameinfo Americas et Asia sont configurés dans `app.js`.

## À savoir
- La page démarre avec des données de démonstration pour montrer la mise en page.
- Les données réelles dépendent des champs renvoyés par l'API publique. Cette première version lit `Killer.Equipment`, `Victim.Equipment` et `Victim.Inventory`.
- La valeur en Silver est volontairement laissée à `—` : l'API de kill ne fournit pas nécessairement une valeur fiable du stuff. On pourra l'ajouter ensuite avec les prix de marché de l'Albion Online Data Project.
- Si le navigateur refuse l'appel direct (CORS), il faudra ajouter un petit proxy côté serveur. Ne contourne pas CORS avec une extension navigateur en production.
- Les API communautaires peuvent évoluer : vérifier le JSON d'un événement réel et adapter `renderEvent()` si nécessaire.

## Prochaine étape
Ajout du calcul de valeur de l'équipement, recherche par nom de joueur/guilde, pagination des kills récents et partage d'une URL par ID de kill.
