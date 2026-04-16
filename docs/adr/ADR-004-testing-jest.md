# ADR-004 - Framework de test: Jest

Statut: Accepte  
Date: 2026-04-16

## Contexte

Le projet NestJS necessite unit, integration et e2e avec un framework stable et bien integre.

## Decision

Standardiser les tests backend sur `Jest`.

## Consequences

- integration native avec tooling NestJS
- ecosysteme mature et documentation abondante
- front peut utiliser Vitest plus tard si besoin, sans impacter la norme backend

## Alternatives considerees

- Vitest: tres performant, mais moins standard cote Nest au demarrage
