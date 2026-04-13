export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ClinicNotApprovedError extends DomainError {
  constructor() {
    super('ClinicNotApprovedError');
  }
}

export class OnboardingIncompleteError extends DomainError {
  constructor() {
    super('OnboardingIncompleteError');
  }
}

export class NotFoundError extends DomainError {
  constructor(message: string = 'Resource not found') {
    super(message);
  }
}

export class ForbiddenError extends DomainError {
  constructor(message: string = 'Permission denied') {
    super(message);
  }
}
