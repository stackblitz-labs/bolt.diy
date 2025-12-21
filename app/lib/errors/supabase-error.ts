/**
 * Custom error class for Supabase RLS context failures
 * Provides structured error handling for Row Level Security issues
 */

export class SupabaseRlsError extends Error {
  readonly code: string;
  readonly userId?: string;
  readonly originalError?: unknown;

  constructor(code: string, message: string, userId?: string, originalError?: unknown) {
    super(message);
    this.name = 'SupabaseRlsError';
    this.code = code;
    this.userId = userId;
    this.originalError = originalError;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SupabaseRlsError);
    }
  }

  /**
   * Creates an error when RLS context setting fails
   */
  static contextSetFailed(userId: string, originalError?: unknown): SupabaseRlsError {
    return new SupabaseRlsError(
      'RLS_CONTEXT_SET_FAILED',
      `Failed to set RLS user context for user: ${userId || 'anonymous'}`,
      userId,
      originalError,
    );
  }

  /**
   * Creates an error when RLS context is not initialized
   */
  static contextNotSet(): SupabaseRlsError {
    return new SupabaseRlsError(
      'RLS_CONTEXT_NOT_SET',
      'RLS user context is not initialized. Cannot proceed with database operations.',
    );
  }

  /**
   * Creates an error when an invalid user ID is provided
   */
  static invalidUserId(): SupabaseRlsError {
    return new SupabaseRlsError('INVALID_USER_ID', 'Invalid user ID provided for RLS context');
  }

  /**
   * Creates an error when RLS context verification fails
   */
  static contextVerificationFailed(userId: string, expected: string, actual: string): SupabaseRlsError {
    return new SupabaseRlsError(
      'RLS_CONTEXT_VERIFICATION_FAILED',
      `RLS context verification failed. Expected: ${expected}, Actual: ${actual}`,
      userId,
    );
  }

  /**
   * Converts the error to a JSON-serializable format
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      userId: this.userId,
      stack: this.stack,
    };
  }
}
