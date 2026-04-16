# ADR-003 - ORM NestJS: Prisma

Statut: Accepte  
Date: 2026-04-16

## Contexte

Le backend NestJS a besoin d'un ORM/type-safe pour PostgreSQL, avec migrations claires et productivite elevee.

## Decision

Adopter `Prisma` comme ORM principal cote API NestJS.

## Consequences

- typage fort et DX excellente
- migrations explicites et traçables
- besoin de discipline sur les requetes complexes (SQL natif ponctuel)

## Alternatives considerees

- TypeORM: mature mais experience schema/migrations moins robuste
- MikroORM: solide, mais moins standard dans l'ecosysteme visé
