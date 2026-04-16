# ERP INA - Dossier Technique Dev/DevOps

Version: 1.0  
Perimetre: Architecture executable, standards engineering, exploitation  
Audience: Equipe backend, frontend, devops, securite, data, QA

---

## 1. Objectif du document

Ce document detaille la cible technique pour construire, deployer, monitorer et faire evoluer la plateforme ERP INA.

Resultat attendu:

- une architecture exploitable en production
- des conventions homogenes pour le code et les API
- un cadre CI/CD fiable
- une exploitation securisee et observable

---

## 2. Scope fonctionnel et technique

Modules cibles:

- Authentification et autorisation
- Media (upload, lecture, metadonnees)
- GED (documents, versioning)
- Workflow (validation, statuts)
- Archives (phase ulterieure)

Systèmes:

- Frontend: Next.js
- API gateway: NestJS
- ERP coeur: Odoo
- Services asynchrones: workers Node.js / Rust
- Data: PostgreSQL, Redis, Object Storage S3 compatible
- Broker messages: RabbitMQ (ou NATS JetStream)

---

## 3. Architecture de reference

```text
[Client Web]
    |
    v
[Next.js BFF light]
    |
    v
[NestJS API Gateway]
  |        |         |
  |        |         +--> [Queue Broker] --> [Workers Node/Rust]
  |        |
  |        +-------------> [Odoo RPC/JSON-RPC]
  |
  +----------------------> [PostgreSQL app]
  +----------------------> [Redis]
  +----------------------> [S3/MinIO]
```

Principes:

- architecture "modular monolith first" pour NestJS
- extraction vers microservices uniquement sur contraintes reelles
- API unique vers le frontend
- traitements lourds hors du chemin synchrone HTTP

---

## 4. Ownership des donnees

Regle cle: chaque domaine a une source de verite explicite.

- Identites et roles applicatifs: NestJS + Odoo (mapping explicite)
- RH/finance/comptabilite: Odoo source principale
- Metadonnees media INA: PostgreSQL applicatif
- Fichiers media/docs: Object Storage
- Etats de jobs async: PostgreSQL applicatif

Conflits et coherence:

- interdiction de double ecriture concurrente sans contrat
- outbox pattern pour evenements critiques
- idempotency key sur operations non atomiques

---

## 5. Organisation du repository

Structure recommandee:

```text
ina-erp/
  apps/
    web/                  # Next.js
    api/                  # NestJS
    worker-node/          # Jobs IO-bound
    worker-rust/          # Jobs CPU-bound (optionnel)
  packages/
    contracts/            # DTO, schemas Zod/OpenAPI shared
    config/               # Config typed
    observability/        # Logger, tracing, metrics wrappers
  infra/
    docker/               # Dockerfiles, compose local
    k8s/                  # Helm charts ou manifests
    terraform/            # IaC cloud
  docs/
    projet.md
    projet-technique-devops.md
```

Standards:

- TypeScript strict mode
- lint + format obligatoires
- conventions commit type Conventional Commits
- code owners pour validation des zones critiques

---

## 6. Conventions API

Base path:

- `/api/v1`

Regles:

- format JSON uniquement
- UTC ISO 8601 pour les dates
- pagination cursor ou `page/limit` normalisee
- tri et filtre via query params specifiques
- `traceId` present sur toutes les erreurs

Reponse succes:

```json
{
  "data": {},
  "meta": {
    "traceId": "01HT..."
  }
}
```

Reponse erreur:

```json
{
  "error": {
    "code": "MEDIA_UPLOAD_FAILED",
    "message": "Upload processing failed",
    "details": {}
  },
  "meta": {
    "traceId": "01HT..."
  }
}
```

HTTP semantics:

- `200/201/204` succes
- `400` validation
- `401/403` authz
- `404` not found
- `409` conflit metier
- `429` rate limit
- `5xx` erreurs serveur

---

## 7. Auth, securite et conformite

Flux auth:

- login: credentials valides -> access token court + refresh token rotatif
- refresh: rotation obligatoire, invalidation ancien refresh token
- logout: revocation server-side

Mesures minimales:

- hash password Argon2id
- TLS obligatoire entre composants
- chiffrement at-rest DB et objets
- secrets hors repo (Vault ou secret manager)
- RBAC + permissions fines par ressource/action
- MFA pour roles sensibles

Audit:

- tracer les actions: login, export, suppression, validation workflow
- retention logs d'audit selon contraintes legales

---

## 8. Asynchrone et workers

Evenements types:

- `media.uploaded`
- `media.processing.requested`
- `media.processing.completed`
- `media.processing.failed`

Contrat de job:

- `jobId` global unique
- `idempotencyKey`
- `correlationId`
- `attempt`
- `payloadVersion`

Fiabilite:

- retries avec backoff exponentiel borne
- dead-letter queue apres N echecs
- compensation metier en cas d'echec irreparable
- endpoint statut job pour le frontend

Etat job:

- `pending`
- `processing`
- `done`
- `failed`
- `cancelled`

---

## 9. Stockage et data lifecycle

Buckets recommandes:

- `media-raw`
- `media-processed`
- `documents`
- `archives`

Regles:

- convention de nommage deterministic (tenant/module/yyyy/mm/id)
- checksum SHA-256 en metadonnees
- antivirus scan sur upload documentaire
- lifecycle policies pour cout stockage

Sauvegarde:

- PostgreSQL: backup quotidien + WAL shipping
- Redis: persistence selon usage (cache vs etat critique)
- S3: versioning + replication inter-zone si necessaire

Objectifs DR:

- RPO cible <= 15 min pour metadonnees critiques
- RTO cible <= 2 h pour API principale

---

## 10. Observabilite

Logging:

- logs structures JSON
- champs obligatoires: `timestamp`, `level`, `service`, `traceId`, `spanId`, `message`

Metrics:

- RED API: rate, errors, duration
- queue depth et age des messages
- taux d'echec jobs par type
- saturation CPU/RAM/io

Tracing:

- OpenTelemetry across web -> api -> odoo -> workers
- propagation W3C Trace Context

Alertes:

- alerte 5xx > seuil sur 5 min
- alerte backlog queue > seuil
- alerte erreur auth anormale

SLO initiaux:

- API read p95 < 500 ms (hors upload)
- taux succes jobs media >= 99%
- disponibilite API mensuelle >= 99.5%

---

## 11. CI/CD

Pipeline CI (pull request):

1. install deps + cache
2. lint
3. tests unitaires
4. tests integration cibles
5. scan securite deps (SCA)
6. build artefacts

Gates obligatoires:

- aucun lint error
- couverture minimale modules critiques (auth, workflow)
- aucun secret detecte
- aucun high severity non accepte

Pipeline CD:

1. build image signee
2. push registry
3. deploy environnement cible
4. smoke tests
5. promotion progressive

Strategie de release:

- trunk-based development
- feature flags pour fonctionnalites sensibles
- blue/green ou canary selon environnement

---

## 12. Environnements

`local`:

- docker compose (db, redis, minio, broker, odoo)
- seed de donnees minimales

`dev`:

- deploiement automatique branche integration
- donnees anonymisees

`staging`:

- miroir production reduit
- tests e2e et tests charge de base

`prod`:

- changements via pipeline uniquement
- approbation manuelle sur fenetres de release

---

## 13. IaC et operations

Infra as code:

- Terraform pour ressources cloud
- Helm charts pour Kubernetes
- modules reutilisables par environnement

Policy:

- no manual drift en production
- tous changements infra via PR
- tagging cout (`env`, `service`, `owner`)

Operations quotidiennes:

- rotation secrets
- patch management images
- verification backup restore mensuelle

---

## 14. Strategie de tests

Pyramide:

- unitaires: logique pure
- integration: DB, Odoo adapters, broker
- contract tests: API et evenements
- e2e: parcours metier critiques

Cas prioritaires:

- login/refresh/logout
- upload media + traitement + statut
- workflow validation et permissions
- droits d'acces GED

Non fonctionnel:

- test charge API lecture
- test resilience broker indisponible
- test reprise apres redemarrage worker

---

## 15. Runbooks incidents

Incident: backlog queue critique

- verifier worker health
- verifier volume input recent
- scaler workers horizontalement
- activer mode degradation si necessaire

Incident: erreur auth massive

- verifier provider identite et db users
- verifier expiration/rotation tokens
- rollback dernier changement auth si corrige

Incident: degradation Odoo

- activer cache lecture si possible
- proteger endpoints dependant Odoo (circuit breaker)
- informer metiers des impacts

Post-mortem:

- timeline factuelle
- cause racine
- actions correctives avec owner/date

---

## 16. Plan de livraison technique (90 jours)

J0-J30:

- baseline repo + CI + environnements local/dev
- auth v1 + RBAC de base
- upload media v1 + stockage

J31-J60:

- workflow v1
- observabilite v1 (logs, metrics, traces)
- staging + smoke tests

J61-J90:

- hardening securite
- performance tuning endpoints critiques
- checklist readiness production

Definition of done release:

- docs API a jour
- runbook operationnel disponible
- alertes actives
- backup restore teste

---

## 17. Checklist go-live

- security review validee
- penetration test planifie ou execute
- SLO dashboards en place
- alertes critiques testees
- procedure rollback validee
- astreinte et escalation connues
- capacite initiale verifiee sur charge cible

---

## 18. Decisions techniques tranchees

Stack engineering:

- gestionnaire de paquets: `pnpm`
- monorepo: `pnpm workspaces + Turborepo`
- ORM NestJS: `Prisma`
- framework de test: `Jest`
- linter/formatter: `ESLint + Prettier`

Integration et messaging:

- broker: `RabbitMQ`
- version Odoo Community: `18.0`
- protocole Odoo: `JSON-RPC` (pas XML-RPC)
- client Odoo: wrapper custom type (NestJS service)

Decisions encore ouvertes (phase 2):

- moteur recherche: Elasticsearch vs Meilisearch
- orchestration prod: Kubernetes complet vs plateforme managée
- niveau fin de couplage IAM Odoo/NestJS

Toutes les decisions majeures sont tracees dans `docs/adr/`.

---

## 19. Schema DB initial (minimal)

Tables auth:

- `auth_users(id, email, password_hash, status, created_at, updated_at)`
- `auth_roles(id, code, label)`
- `auth_user_roles(user_id, role_id)`
- `auth_sessions(id, user_id, ip, user_agent, revoked_at, expires_at, created_at)`
- `auth_refresh_tokens(id, session_id, token_hash, rotated_from, revoked_at, expires_at, created_at)`

Tables media:

- `media_assets(id, owner_user_id, title, kind, status, storage_bucket, storage_key, checksum_sha256, duration_ms, size_bytes, created_at, updated_at)`
- `media_versions(id, asset_id, version_no, storage_key, created_by, created_at)`

Tables workflow:

- `workflow_definitions(id, code, name, is_active)`
- `workflow_instances(id, definition_id, entity_type, entity_id, status, current_step, created_by, created_at, updated_at)`
- `workflow_actions(id, instance_id, actor_user_id, action, comment, created_at)`

Contraintes minimales:

- cles etrangeres systematiques
- index sur `email`, `status`, `created_at`, `entity_type/entity_id`
- unicite sur `auth_users.email` et `(media_versions.asset_id, media_versions.version_no)`

---

## 20. Contrats Odoo (MVP)

Modules Odoo actifs:

- `base`
- `contacts`
- `hr`
- `hr_contract`
- `account`
- `mail`

Modeles exposes via NestJS:

- `res.users`: `id`, `login`, `name`, `active`, `groups_id`
- `res.partner`: `id`, `name`, `email`, `phone`, `is_company`
- `hr.employee`: `id`, `name`, `work_email`, `department_id`, `job_title`
- `account.move` (lecture controlee): `id`, `name`, `move_type`, `state`, `invoice_date`, `amount_total`, `currency_id`

Regles contractuelles:

- jamais de payload Odoo brut vers le frontend
- mapping DTO explicite dans l'API NestJS
- timeout/retry/circuit-breaker sur appels RPC
- traçabilite `traceId` sur chaque appel Odoo

---

## 21. Docker Compose local (reference)

Versions/images:

- `postgres:16` (app + odoo db)
- `redis:7`
- `rabbitmq:3.13-management`
- `minio/minio:RELEASE.2025-01-20T14-49-07Z`
- `odoo:18.0`

Ports:

- PostgreSQL app: `5432`
- Redis: `6379`
- RabbitMQ: `5672`, UI `15672`
- MinIO API: `9000`, console: `9001`
- Odoo: `8069`

Volumes:

- `pg_data`, `redis_data`, `rabbit_data`, `minio_data`, `odoo_data`, `odoo_pg_data`

Note:

- conserver un compose unique versionne dans `infra/docker/compose.local.yml`
- toute variation locale doit passer par overrides non committees

---

## 22. Seed data (dev local)

Utilisateurs de test:

- `admin@ina.local` -> `ADMIN`
- `editor@ina.local` -> `EDITOR`
- `reviewer@ina.local` -> `REVIEWER`
- `viewer@ina.local` -> `VIEWER`

Regles seed:

- mot de passe initial dev unique (`ChangeMe123!`) avec reset force
- creation de 10 assets media (video/audio/image/document)
- creation de 3 workflows (`MEDIA_PUBLISH`, `DOC_APPROVAL`, `FORM_APPROVAL`)
- injection de quelques jobs en echec pour tester alertes et runbooks

Automatisation:

- commande seed idempotente (`pnpm seed:dev`)
- reseed complet possible via `pnpm seed:reset`

---

## 23. Annexes

Annexe A - Variables d'environnement minimales:

- `NODE_ENV`
- `API_PORT`
- `DATABASE_URL`
- `REDIS_URL`
- `S3_ENDPOINT`
- `S3_ACCESS_KEY`
- `S3_SECRET_KEY`
- `BROKER_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `ODOO_URL`
- `ODOO_DB`
- `ODOO_USER`
- `ODOO_PASSWORD`

Annexe B - Naming conventions:

- services: `ina-{module}-{env}`
- topics/queues: `{domain}.{action}.v{n}`
- DB migrations: `YYYYMMDDHHMM_{name}.sql`

---
