export class OfficeError extends Error {
  constructor(message, status = 500, code = 'office_error', headers = {}) {
    super(message);
    this.name = 'OfficeError';
    Object.assign(this, { status, code, headers });
  }
}

export function lockConflict(lock = '') {
  return new OfficeError('El documento tiene un bloqueo distinto o una versión más reciente.', 409, 'lock_conflict', { 'X-WOPI-Lock': lock });
}
