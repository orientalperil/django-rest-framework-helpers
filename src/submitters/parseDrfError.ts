/**
 * Parse a Django REST Framework error body into a framework-neutral shape.
 *
 * Every Submitter reads the same DRF error and routes it into its own library's
 * error model. The traversal (guard missing body -> `detail` -> split
 * `non_field_errors` from field errors -> flatten one level of nesting) is
 * identical across all of them, so it lives here once. Each Submitter's
 * `handleError`/`parseError` becomes a thin adapter over `NormalizedErrors`.
 */
import type { ApiError } from "../shared/types.js"

/** Framework-neutral, normalized server errors. */
export interface NormalizedErrors {
  /** detail / non_field_errors — form-level messages. */
  formLevel: string[]
  /** field path (dotted, one level deep) -> messages. */
  fields: Record<string, string[]>
}

const GENERIC = "Something went wrong. Please try again."

export function parseDrfError(error: unknown): NormalizedErrors {
  const data = (error as ApiError | undefined)?.response?.data

  // No structured body: network error, timeout, CORS, etc.
  if (!data) return { formLevel: [GENERIC], fields: {} }

  // Case 1: APIException-style { detail: "..." }
  if (data.detail) return { formLevel: [data.detail], fields: {} }

  // Case 2 + 3: serializer errors. Split non-field from field errors.
  const { non_field_errors: nonField, ...fieldErrors } = data

  const formLevel: string[] = nonField ? (Array.isArray(nonField) ? nonField : [nonField]) : []

  // Flatten one level of nesting (profile.bio) into dotted paths.
  const fields: Record<string, string[]> = {}
  for (const [field, messages] of Object.entries(fieldErrors)) {
    if (Array.isArray(messages)) {
      fields[field] = messages
    } else if (messages && typeof messages === "object") {
      for (const [sub, subMessages] of Object.entries(messages)) {
        fields[`${field}.${sub}`] = Array.isArray(subMessages) ? subMessages : [subMessages]
      }
    } else if (messages != null) {
      fields[field] = [String(messages)]
    }
  }

  return { formLevel, fields }
}
