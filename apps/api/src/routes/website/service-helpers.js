export class WebsiteServiceError extends Error {
  constructor(message, status = 500) {
    super(message)
    this.name = 'WebsiteServiceError'
    this.status = status
  }
}

export function notFound(entity) {
  return new WebsiteServiceError(`${entity} no encontrado.`, 404)
}

export function conflict(message) {
  return new WebsiteServiceError(message, 409)
}
