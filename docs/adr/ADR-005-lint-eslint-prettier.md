# ADR-005 - Lint et format: ESLint + Prettier

Statut: Accepte  
Date: 2026-04-16

## Contexte

Le codebase combine Next.js et NestJS. Il faut un standard de qualite commun et stable.

## Decision

Utiliser `ESLint` pour les regles et `Prettier` pour le formatage.

## Consequences

- compatibilite maximale avec plugins framework
- pipeline de qualite simple a imposer en CI
- Biome pourra etre revalue en phase d'optimisation outillage

## Alternatives considerees

- Biome: prometteur et rapide, mais non retenu au demarrage pour minimiser les risques d'ecosysteme
