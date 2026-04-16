# ADR-002 - Outil monorepo: pnpm workspaces + Turborepo

Statut: Accepte  
Date: 2026-04-16

## Contexte

Le repo contient plusieurs applications et packages partages. Il faut orchestrer builds/tests/lint avec cache pour accelerer CI/CD.

## Decision

Utiliser `pnpm workspaces` pour la gestion des packages et `Turborepo` pour l'orchestration des tasks.

## Consequences

- pipeline local/CI plus rapide via cache
- configuration legere comparee a Nx
- dependance supplementaire a maintenir (turbo)

## Alternatives considerees

- Nx: plus riche mais plus complexe pour phase initiale
- workspaces seuls: trop limite pour orchestration/caching a l'echelle
