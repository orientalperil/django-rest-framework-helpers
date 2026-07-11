/**
 * Submitter for FormKit (headless usage via <FormKit type="form"> + custom inputs).
 *
 * FormKit has the best-matched error API for a DRF backend:
 *
 *   node.setErrors(formLevelErrors, inputErrors)
 *     - formLevelErrors: string | string[]              -> rendered at form top
 *     - inputErrors:     { fieldName: string|string[] } -> rendered per field
 *
 * That maps almost 1:1 onto DRF:
 *   detail / non_field_errors  -> formLevelErrors
 *   { field: [...] }           -> inputErrors
 *
 * This is the closest analog to the original Vueform code, where
 * `messageBag.prepend` handled top-level messages and per-element message bags
 * handled field messages.
 */
import { parseDrfError } from "./parseDrfError.js"
import type { FormKitNode } from "@formkit/core"

export class FormKitSubmitter<TData = Record<string, unknown>> {
  constructor() {
    this.submit = this.submit.bind(this)
  }

  handleError(error: unknown, node: FormKitNode) {
    // Normalized `fields` are keyed by dotted paths, which already match
    // FormKit's group/nested input names. Single call sets both buckets;
    // FormKit clears them automatically when the user edits the offending field.
    const { formLevel, fields } = parseDrfError(error)
    node.setErrors(formLevel, fields)
  }

  async action(_data: TData): Promise<void> {}
  async success(_data: TData): Promise<void> {}
  async error(_error: unknown): Promise<void> {}
  async finally(): Promise<void> {}

  /**
   * Pass as the form's @submit handler:
   *   <FormKit type="form" @submit="submitter.submit">
   * FormKit only fires @submit after its own validation passes, sets the form's
   * loading/disabled state for the duration of the returned promise, and passes
   * (data, node).
   */
  async submit(data: TData, node: FormKitNode) {
    node.clearErrors()
    try {
      await this.action(data)
      await this.success(data)
    } catch (error) {
      this.handleError(error, node)
      await this.error(error)
    } finally {
      await this.finally()
    }
  }
}
