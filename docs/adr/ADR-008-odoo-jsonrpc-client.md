# ADR-008 - Connexion Odoo: JSON-RPC avec client custom

Statut: Accepte  
Date: 2026-04-16

## Contexte

L'API NestJS doit integrer Odoo avec controle fin des DTO, erreurs et observabilite.

## Decision

Utiliser `JSON-RPC` pour Odoo et implementer un client custom type dans NestJS (`OdooClientService`).

## Consequences

- controle complet des contrats et mappings
- instrumentation (timeout, retry, traceId, circuit-breaker) maitrisee
- effort initial de developpement du client

## Alternatives considerees

- XML-RPC: legacy et moins adapte a la cible
- bibliotheques externes non maitrisees: risque de couplage et dette de maintenance
