import pino from 'pino'

/**
 * Shared pino logger — the same instance backs the Fastify app (passed as its
 * `logger`) and the k8s manager, so all output is one consistent JSON stream.
 * No pino-pretty / transport.
 */
export const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' })
