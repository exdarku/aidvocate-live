import { config } from "../config.js";

/** 404 handler for unmatched routes. */
export function notFound(req, res) {
  res.status(404).json({ error: "Not found" });
}

/**
 * Centralised error handler. Logs the full error server-side but never leaks
 * internal messages/stack traces to clients in production. Routes can throw or
 * call next(err); thrown errors carry an optional `status` and a `public`
 * message that is safe to return to the client.
 */
// eslint-disable-next-line no-unused-vars -- Express identifies error handlers by arity (4 args)
export function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;

  // 4xx are client errors with safe messages; 5xx must not leak internals.
  const message =
    status < 500
      ? err.public || err.message || "Bad request"
      : config.isProd
        ? "Internal server error"
        : err.message;

  if (status >= 500) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
  }

  res.status(status).json({ error: message });
}

/** Throwable HTTP error with a client-safe message. */
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.public = message;
  }
}
