export class SagaliciousError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SagaliciousError';
    Object.setPrototypeOf(this, SagaliciousError.prototype);
  }
}

export class NoProcessorFoundError extends SagaliciousError {
  constructor(command: any) {
    super(
      `No processor found for command: ${command.constructor?.name || typeof command}`,
    );
    this.name = 'NoProcessorFoundError';
    Object.setPrototypeOf(this, NoProcessorFoundError.prototype);
  }
}
