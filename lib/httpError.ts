/**
 * An error an API route turns into a JSON response (see handle() in
 * lib/apiAuth.ts). Kept free of server-only imports so validation code
 * shared with client components can throw it.
 */
export class HttpError extends Error {
  /** `extra` fields are sent next to `error` in the JSON body (e.g. huntId, priceEuros). */
  constructor(public status: number, public code: string, public extra?: Record<string, unknown>) {
    super(code)
  }
}
