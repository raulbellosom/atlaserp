export class StorefrontError extends Error {
  constructor(message, code = 'UNKNOWN', status = 500, details = null) {
    super(message)
    this.name = 'StorefrontError'
    this.code = code
    this.status = status
    this.details = details
  }
}
