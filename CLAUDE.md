# CLAUDE.md

Ce fichier fournit des directives a Claude Code (claude.ai/code) pour travailler sur ce depot.

## Presentation du projet

Plateforme ERP pour un institut audiovisuel (INA). Gere les medias (audio, video, images), les documents electroniques (GED), les workflows, les archives, et integre les fonctions ERP (RH, finance, comptabilite). Specs dans `docs/projet.md` et `docs/projet-technique-devops.md`. Decisions techniques dans `docs/adr/`.

**Statut** : Pre-implementation (phase architecture). Pas encore de code source.

## Stack technique (decisions ADR)

- **Package manager** : pnpm (ADR-001)
- **Monorepo** : pnpm workspaces + Turborepo (ADR-002)
- **ORM** : Prisma (ADR-003)
- **Tests backend** : Jest (ADR-004) — Vitest possible cote frontend plus tard
- **Lint/format** : ESLint + Prettier (ADR-005)
- **Broker** : RabbitMQ (ADR-006)
- **ERP** : Odoo Community 18.0 (ADR-007)
- **Connexion Odoo** : JSON-RPC via client custom `OdooClientService` (ADR-008)
- **Frontend** : Next.js / React / TypeScript
- **API Gateway** : NestJS
- **DB** : PostgreSQL — **Cache** : Redis — **Object Storage** : MinIO/S3

## Commandes de developpement

```bash
pnpm install                    # installer les dependances
pnpm turbo build                # build tous les packages/apps
pnpm turbo lint                 # lint global
pnpm turbo test                 # tests globaux
pnpm turbo test --filter=api    # tests d'une seule app
pnpm turbo dev                  # lancer en mode dev
```

## Architecture

```
[Client Web]
    |
    v
[Next.js BFF light]
    |
    v
[NestJS API Gateway] — point d'entree unique, auth, orchestration
  |        |         |
  |        |         +--> [RabbitMQ] --> [Workers Node/Rust]
  |        |
  |        +-------------> [Odoo 18 JSON-RPC] (ERP coeur)
  |
  +----------------------> [PostgreSQL + Prisma]
  +----------------------> [Redis]
  +----------------------> [S3/MinIO]
```

Principes :
- Architecture "modular monolith first" pour NestJS
- Extraction microservices uniquement sur contraintes reelles
- Traitements lourds hors du chemin synchrone HTTP

## Structure du repository

```
ina-erp/
  apps/
    web/                  # Next.js
    api/                  # NestJS
    worker-node/          # Jobs IO-bound
    worker-rust/          # Jobs CPU-bound (optionnel)
  packages/
    contracts/            # DTO, schemas Zod/OpenAPI partages
    config/               # Config typee
    observability/        # Logger, tracing, metrics wrappers
  infra/
    docker/               # Dockerfiles, compose local
    k8s/                  # Helm charts ou manifests
    terraform/            # IaC cloud
  docs/
    adr/                  # Architecture Decision Records
```

## Standards de code

- TypeScript strict mode
- ESLint + Prettier obligatoires (zero lint error en CI)
- Conventional Commits (`feat:`, `fix:`, `chore:`, etc.)
- Code owners pour validation des zones critiques

## Regles d'architecture strictes

**Interdit :**
- Connexion directe Frontend vers Odoo (tout passe par NestJS)
- Logique metier dans le frontend
- Multiplication prematuree des microservices
- Backend full Rust pour la logique metier standard
- Double ecriture concurrente sans contrat

**Obligatoire :**
- Chaque endpoint protege par auth + autorisation (guards NestJS)
- Documentation OpenAPI/Swagger pour tous les endpoints
- Outbox pattern pour evenements critiques
- Cles d'idempotence sur operations non atomiques

## Conventions API

Base path : `/api/v1/...` — JSON uniquement — dates en UTC ISO 8601

Reponse succes :
```json
{ "data": {}, "meta": { "traceId": "01HT..." } }
```

Reponse erreur :
```json
{ "error": { "code": "MEDIA_UPLOAD_FAILED", "message": "...", "details": {} }, "meta": { "traceId": "01HT..." } }
```

Codes HTTP : `200/201/204` succes, `400` validation, `401/403` authz, `404` not found, `409` conflit metier, `429` rate limit, `5xx` erreurs serveur

Pagination cursor ou `page/limit` normalisee. `traceId` present sur toutes les reponses.

## Modele d'authentification

Flux : `User -> Frontend -> NestJS -> Odoo (validation identite) -> NestJS -> JWT -> Frontend`

- JWT access token courte duree + refresh token rotatif (rotation obligatoire)
- Hash password : Argon2id
- Revocation server-side au logout
- RBAC + permissions fines par ressource/action
- MFA pour profils sensibles (admin, finance, RH)
- TLS obligatoire entre composants
- Secrets hors repo (Vault ou secret manager)

## Ownership des donnees

Chaque domaine a une source de verite explicite :
- Identites et roles applicatifs : NestJS + Odoo (mapping explicite)
- RH/finance/comptabilite : Odoo source principale
- Metadonnees media INA : PostgreSQL applicatif (via Prisma)
- Fichiers media/docs : Object Storage
- Etats de jobs async : PostgreSQL applicatif

## Traitement asynchrone

Evenements types : `media.uploaded`, `media.processing.requested`, `media.processing.completed`, `media.processing.failed`

Contrat de job : `jobId`, `idempotencyKey`, `correlationId`, `attempt`, `payloadVersion`

Machine d'etat : `pending -> processing -> done | failed | cancelled`

Garanties : retries backoff exponentiel borne, DLQ apres N echecs, compensation metier si echec irreparable.

## Integration Odoo

- Client custom `OdooClientService` dans NestJS (ADR-008)
- Protocole JSON-RPC vers Odoo 18.0 Community
- Instrumentation integree : timeout, retry, traceId, circuit-breaker
- Controle complet des contrats et mappings DTO

## Stockage

Buckets : `media-raw`, `media-processed`, `documents`, `archives`

Nommage objets : `tenant/module/yyyy/mm/id` — checksum SHA-256 en metadonnees — antivirus scan sur upload documentaire

Backup : PostgreSQL backup quotidien + WAL shipping — RPO <= 15 min — RTO <= 2 h

## Conventions de nommage

- Services : `ina-{module}-{env}`
- Topics/queues : `{domain}.{action}.v{n}`
- DB migrations Prisma : `YYYYMMDDHHMM_{name}.sql`

## Environnement local

Docker Compose avec : db, redis, minio, rabbitmq, odoo. Seed de donnees minimales.

Variables d'environnement minimales : `NODE_ENV`, `API_PORT`, `DATABASE_URL`, `REDIS_URL`, `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `BROKER_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `ODOO_URL`, `ODOO_DB`, `ODOO_USER`, `ODOO_PASSWORD`

## CI/CD

Pipeline CI (pull request) : `pnpm install` + cache -> lint -> tests unitaires -> tests integration cibles -> scan securite deps (SCA) -> build artefacts

Gates obligatoires : zero lint error, couverture minimale modules critiques (auth, workflow), aucun secret detecte, aucune vuln high severity non acceptee

Strategie de release : trunk-based development, feature flags pour fonctionnalites sensibles, blue/green ou canary selon environnement

## Strategie de tests

Pyramide : unitaires (logique pure) -> integration (DB, Odoo adapters, broker) -> contract tests (API et evenements) -> e2e (parcours metier critiques)

Cas prioritaires : login/refresh/logout, upload media + traitement + statut, workflow validation et permissions, droits d'acces GED

## Observabilite

- Logs structures JSON : champs obligatoires `timestamp`, `level`, `service`, `traceId`, `spanId`, `message`
- Metrics RED : rate, errors, duration + queue depth + taux echec jobs
- Tracing : OpenTelemetry avec propagation W3C Trace Context
- SLO : API read p95 < 500 ms, taux succes jobs media >= 99%, disponibilite API >= 99.5%

## Decisions ouvertes

A capturer en ADR dans `docs/adr/` :
- Moteur recherche phase 2 : Elasticsearch vs Meilisearch
- Orchestration prod : Kubernetes complet vs plateforme managee
- Niveau couplage IAM Odoo/NestJS

## Perimetre MVP (Phase 1 — 90 jours)

J0-J30 : baseline repo + CI + envs local/dev, auth v1 + RBAC, upload media v1

J31-J60 : workflow v1, observabilite v1 (logs, metrics, traces), staging + smoke tests

J61-J90 : hardening securite, performance tuning, checklist readiness production
