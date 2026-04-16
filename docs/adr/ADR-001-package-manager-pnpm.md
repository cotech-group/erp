# ADR-001 - Choix du gestionnaire de paquets: pnpm

Statut: Accepte  
Date: 2026-04-16

## Contexte

Le projet est un monorepo (web, api, workers, packages partages). Le temps d'installation, la coherence des dependances et la fiabilite du lockfile sont critiques.

## Decision

Adopter `pnpm` comme gestionnaire de paquets unique.

## Consequences

- installations plus rapides et economes en disque
- lockfile strict et reproductible
- meilleur comportement en workspace que npm/yarn classique
- onboarding necessite installation de pnpm

## Alternatives considerees

- npm: simple mais moins optimise pour gros monorepo
- yarn: bon historique, mais pas retenu pour coherence et perf ciblees
