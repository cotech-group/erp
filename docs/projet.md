📦 ERP INA - Devbook Architecture et Plan de Developpement

## 1. Vision du projet

Developper une plateforme ERP moderne pour un institut audiovisuel (INA), permettant :

- la gestion des medias (audio, video, images)
- l'archivage intelligent
- la digitalisation des procedures internes
- la gestion electronique de documents (GED)
- l'orchestration de workflows metiers
- l'integration ERP (RH, finance, comptabilite)

---

## 2. Architecture globale

```text
Frontend (Next.js / React)
        |
        v
API Gateway (NestJS)
        |
        v
---------------------------------------------------------
|                         |                              |
v                         v                              v
Odoo (ERP coeur)     Services Node.js              Workers Rust
                     (metier, integration)         (traitement media)
```

Principes :

- le frontend ne communique jamais directement avec Odoo
- NestJS est le point d'entree unique API, securite et orchestration
- les traitements lourds sont decouples via une file de messages

---

## 3. Stack technique

Frontend :

- Next.js
- React
- TypeScript

Backend API :

- NestJS (Node.js)
- REST (GraphQL possible en phase ulterieure)
- OpenAPI (Swagger) obligatoire

Backend metier :

- Odoo Community (modules ERP coeur)

Services complementaires :

- Node.js pour integrations et traitements metiers transverses

Performance / traitement :

- Rust pour le media processing (encodage, compression, previews)

Data :

- PostgreSQL (Odoo + schemas applicatifs)
- Redis (cache, rate limit, sessions techniques)
- Object Storage (MinIO / S3 compatible)

Messagerie :

- Queue broker (RabbitMQ ou NATS JetStream) pour traitements asynchrones

---

## 4. Authentification et securite

Flux de base :

```text
User -> Frontend -> NestJS -> Odoo (validation identite) -> NestJS -> JWT -> Frontend
```

Regles minimales :

- authentification centralisee dans NestJS
- JWT access token courte duree + refresh token rotatif
- revocation de sessions (blacklist ou token versioning)
- RBAC (roles) + permissions fines par ressource
- MFA pour profils sensibles (admin, finance, RH)
- journalisation des actions critiques (audit trail)

Controle d'acces :

- policy guard au niveau API (NestJS)
- interdiction d'acces direct Odoo depuis le navigateur
- separation stricte entre authentification, autorisation, et regles metier

---

## 5. Organisation des modules

Core :

- Auth
- Users
- Permissions
- Audit

ERP (Odoo) :

- RH
- Comptabilite
- Finance

Metier INA :

Media :

- upload fichiers
- metadonnees
- preview
- versioning
- lifecycle (brouillon, publie, archive)

Archives :

- indexation
- recherche avancee
- archivage long terme
- politiques de retention

GED :

- gestion de documents
- versioning
- classification
- droits d'acces documentaires

Workflow :

- validation
- statuts
- assignation de taches
- historique de decisions

Dematerialisation :

- formulaires
- validation hierarchique
- circuits internes

Services transverses :

- Notifications (email, in-app)
- Logs
- Recherche globale
- Observabilite (metrics, traces, alertes)

---

## 6. Gouvernance API (NestJS)

Role de l'API :

- abstraction Odoo
- securite
- transformation des donnees
- orchestration inter-modules
- enforcement des contrats d'echange

Standards API :

- versionnement (`/api/v1/...`)
- schema d'erreur uniforme (`code`, `message`, `details`, `traceId`)
- pagination et tri standards
- idempotency key sur operations sensibles (upload, validation)
- rate limiting et protection anti-abus

Exemples endpoints :

```http
GET    /api/v1/media
POST   /api/v1/media/upload
GET    /api/v1/documents
POST   /api/v1/workflow/validate
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout
```

---

## 7. Flux de donnees et fiabilite

Exemple : recuperation medias

```text
Frontend -> GET /api/v1/media
NestJS -> Odoo RPC / service metier
NestJS -> normalisation + filtrage permissions
NestJS -> JSON contractuel
Frontend -> affichage
```

Exemple : upload asynchrone

```text
Frontend -> API upload -> Storage (objet brut)
API -> publie evenement -> Queue
Worker -> traitement -> ecrit resultat + statut
API -> expose statut de traitement
```

Garanties minimales :

- idempotence des jobs
- retries bornes avec backoff
- dead-letter queue (DLQ)
- correlation id de bout en bout
- machine d'etat de traitement (`pending`, `processing`, `done`, `failed`)

---

## 8. Workers Rust (optionnel au demarrage)

Cas d'usage :

- encodage video
- compression
- generation de preview
- extraction de metadonnees techniques

Strategie :

- phase MVP : traitement simple possible en Node.js
- phase scale : bascule vers Rust sur charges lourdes
- execution via queue, jamais en synchrone HTTP

---

## 9. Recherche

Phase 1 :

- recherche simple PostgreSQL (index SQL + filtres metadonnees)

Phase 2 :

- moteur dedie (Elasticsearch ou Meilisearch)
- indexation evenementielle
- facettes et scoring personnalise

---

## 10. Stockage, sauvegarde et retention

Medias :

- MinIO / S3
- versioning objet active
- chiffrement at-rest et in-transit

Documents :

- stockage structure par domaine/metier
- conventions de nommage et metadonnees obligatoires

Exploitation :

- sauvegardes quotidiennes + tests de restauration
- politique de retention (metier + legal)
- objectifs RPO/RTO definis

---

## 11. Observabilite et exploitation

Logs :

- logs structures JSON
- centralisation (ELK / OpenSearch / Loki)

Metrics :

- latence API, taux erreur, debit, saturation workers
- tableaux de bord par module

Tracing :

- OpenTelemetry de bout en bout
- traceId expose dans les reponses d'erreur

Alerting :

- seuils critiques (5xx, queue backlog, echec traitements)
- astreinte equipe technique

---

## 12. Roadmap

Phase 1 - MVP (objectif 3 a 4 mois) :

- Auth complete (login, refresh, logout, RBAC de base)
- Media : upload, lecture, metadonnees minimales
- GED simple : depot, consultation, versioning basique
- Workflow basique : validation a un niveau
- observabilite minimale (logs + metrics API)

Criteres de sortie MVP :

- parcours critiques couverts par tests d'integration
- SLA interne defini (ex: API p95 < 500 ms hors upload)
- sauvegarde et restauration validees

Phase 2 :

- archives avancees
- recherche globale
- notifications multi-canal
- audit trail et politiques de retention

Phase 3 :

- industrialisation workers Rust
- optimisation performance/couts
- analytics et pilotage metier

---

## 13. Regles d'architecture

Interdits :

- pas de connexion directe Frontend -> Odoo
- pas de multiplication prematuree des microservices
- pas de backend full Rust pour la logique metier standard
- pas de logique metier dans le frontend

Obligations :

- toujours passer par NestJS
- separer responsabilites (API, metier, stockage, traitement)
- documenter les contrats d'API et d'evenements
- proteger chaque endpoint par auth + autorisation

---

## 14. Principes cles

- simplicite d'abord
- modularite
- scalabilite progressive
- separation claire des couches
- securite by design
- observabilite des le MVP

---

## 15. Objectif final

Construire :

- une plateforme robuste
- scalable sur plusieurs annees
- adaptee aux besoins audiovisuels
- maintenable par une equipe pluridisciplinaire
- evolutive sans rupture d'architecture

---
