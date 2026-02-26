# Trajet Emploi

Extension Firefox qui affiche automatiquement le temps de trajet et la distance entre votre domicile et le lieu de chaque offre d'emploi, directement dans la page.

## Sites supportés

| Site | Statut |
|------|--------|
| [leforem.be](https://www.leforem.be) | ✅ Supporté |
| [ictjob.be](https://www.ictjob.be) | ✅ Supporté |
| [stepstone.be](https://www.stepstone.be/fr/) | ✅ Supporté |
| [jobat.be](https://www.jobat.be) | ✅ Supporté |
| [brusselsjobs.com](https://www.brusselsjobs.com) | ✅ Supporté |
| [techjobs.be](https://www.techjobs.be) | ✅ Supporté |
| [linkedin.com/jobs](https://www.linkedin.com/jobs/) | ✅ Supporté |
| [indeed.com](https://www.indeed.com) | ✅ Supporté |


## Fonctionnement

1. Vous configurez votre ville de départ une seule fois via le popup de l'extension.
2. En naviguant sur un site supporté, un badge apparaît automatiquement à côté de chaque localisation d'offre :
   - `⏳` pendant le calcul
   - `🚗 23 min · 18 km` une fois le trajet calculé
   - `⚠` si la ville est introuvable ou le trajet impossible

Les calculs sont mis en cache : une même ville n'est géocodée et routée qu'une seule fois par session.

## Installation

1. Clonez ou téléchargez ce dépôt.
2. Ouvrez Firefox et allez sur `about:debugging`.
3. Cliquez sur **Ce Firefox** > **Charger un module complémentaire temporaire**.
4. Sélectionnez le fichier `manifest.json`.

## Configuration

Cliquez sur l'icône de l'extension pour ouvrir le popup :

- **Ville de départ** — entrez votre ville et cliquez sur *Enregistrer*. La ville est géocodée via [Nominatim](https://nominatim.openstreetmap.org/) (OpenStreetMap).
- **Options avancées** — choisissez le service d'itinéraire à utiliser.

## Services d'itinéraire

| Service | Limite | Clé API requise |
|---------|--------|-----------------|
| **OSRM** (défaut) | Aucune | Non |
| **OpenRouteService** | 500 req/jour | Oui ([obtenir](https://openrouteservice.org/dev/#/signup)) |
| **HERE Routing** | 250 000 req/mois | Oui ([obtenir](https://developer.here.com/sign-up)) |
| **Google Maps** | 40 000 req/mois (crédit offert) | Oui ([obtenir](https://developers.google.com/maps/documentation/distance-matrix/get-api-key)) |

Pour les services avec limite, l'extension suit votre consommation et vous notifie par seuils configurables (50 %, 75 %, 90 %, quota épuisé).

## Architecture

```
manifest.json      — Déclaration MV2, permissions, content script
content.js         — Injection des badges, MutationObserver, appels API
popup.html/css/js  — Interface de configuration et suivi de progression
background.js      — Suivi des quotas API et notifications
icons/             — Icônes 48×96 px (générées en Python)
```

**Flux principal dans `content.js` :**

```
init()
 └─ détecte le site (SITES[])
 └─ charge la config (departure, routingService)
 └─ processNewElements() → injectBadge() × N → queue[]
 └─ startObserver()      → surveille les nouveaux éléments (SPA/scroll)
 └─ processQueue()       → geocode() + getRoute() → met à jour les badges
```

## Signaler un bug

Cliquez sur **🐛 Signaler un bug** dans le popup : un rapport complet (service, ville, journal d'erreurs) est copié dans le presse-papiers et la page GitHub Issues s'ouvre automatiquement.
