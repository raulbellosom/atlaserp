export class ModuleEngineError extends Error {
  constructor(message, code = 'AME_VALIDATION_ERROR') {
    super(message)
    this.name = 'ModuleEngineError'
    this.code = code
  }
}
