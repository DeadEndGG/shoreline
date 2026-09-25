import { HttpErrorResponse } from '@angular/common/http';
import { ValidationProblem } from './models';

/** Flattens an RFC 7807 validation problem into field → first message. */
export function fieldErrors(error: unknown): Record<string, string> {
  if (error instanceof HttpErrorResponse && error.status === 400) {
    const problem = error.error as ValidationProblem | null;
    const result: Record<string, string> = {};
    for (const [field, messages] of Object.entries(problem?.errors ?? {})) {
      result[field.charAt(0).toLowerCase() + field.slice(1)] = messages[0];
    }
    return result;
  }
  return {};
}

export function errorMessage(error: unknown): string {
  const fields = Object.values(fieldErrors(error));
  if (fields.length) {
    return fields[0];
  }
  if (error instanceof HttpErrorResponse && error.status === 0) {
    return 'The demo API is not reachable. Is the backend running?';
  }
  return 'Something went wrong. Please try again.';
}
