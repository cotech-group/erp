# ADR-006 - Broker asynchrone: RabbitMQ

Statut: Accepte  
Date: 2026-04-16

## Contexte

Les workflows media exigent retries, routage fiable et dead-letter queues.

## Decision

Adopter `RabbitMQ` comme broker principal pour les traitements asynchrones.

## Consequences

- modele queue/exchange mature et bien compris
- support natif DLQ et patterns de retry robustes
- operations a encadrer (monitoring, tuning, retention)

## Alternatives considerees

- NATS JetStream: excellent pour event streaming, non retenu pour priorite "queue workflow" MVP
