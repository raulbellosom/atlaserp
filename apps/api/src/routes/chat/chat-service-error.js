export class ChatServiceError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "ChatServiceError";
    this.status = status;
  }
}
