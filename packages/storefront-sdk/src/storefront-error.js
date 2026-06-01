/**
 * Error thrown by all SDK methods on failure.
 * @extends Error
 * @property {string} code - Machine-readable code: UNAUTHORIZED | FORBIDDEN | NOT_FOUND | VALIDATION_ERROR | MODULE_NOT_AVAILABLE | NETWORK_ERROR | UNKNOWN
 * @property {number} status - HTTP status code (0 for network errors)
 * @property {any|null} details - Extra validation details, if any
 */
export class StorefrontError extends Error {
  /**
   * @param {string} message - Human-readable error message
   * @param {string} [code='UNKNOWN'] - Machine-readable error code
   * @param {number} [status=500] - HTTP status code
   * @param {any} [details=null] - Extra details (e.g. field validation errors)
   */
  constructor(message, code = 'UNKNOWN', status = 500, details = null) {
    super(message)
    this.name = 'StorefrontError'
    this.code = code
    this.status = status
    this.details = details
  }
}
