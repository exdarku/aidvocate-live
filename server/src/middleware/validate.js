import { HttpError } from "./error.js";

/**
 * Returns middleware that validates req.body against a Zod schema. On success,
 * req.body is replaced with the parsed (and coerced) data. On failure, responds
 * 400 with a concise, client-safe message — never the raw error object.
 */
export function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const first = result.error.issues[0];
      const path = first.path.join(".");
      throw new HttpError(400, path ? `${path}: ${first.message}` : first.message);
    }
    req.body = result.data;
    next();
  };
}
