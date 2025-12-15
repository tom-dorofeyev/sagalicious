import { TransactionRepository } from './repository.interface';

/**
 * Global configuration for Sagalicious.
 * Set once at application initialization to avoid repeating configuration for each saga.
 */
export interface SagaliciousConfig {
  /**
   * Default repository to use for all sagas unless overridden.
   * When set, all sagas created with createSaga() will automatically use this repository.
   */
  repository?: TransactionRepository;
}

let globalConfig: SagaliciousConfig = {};

/**
 * Configure global settings for Sagalicious.
 * Call this once at application startup to set defaults for all sagas.
 *
 * @example
 * ```typescript
 * import { configureSagalicious } from 'sagalicious';
 * import { MongoTransactionRepository } from './repositories/mongo';
 *
 * // At app initialization
 * configureSagalicious({
 *   repository: new MongoTransactionRepository()
 * });
 *
 * // Now all sagas use this repository automatically
 * const saga = createSaga()
 *   .handler('payment', { execute, rollback })
 *   .build(); // No need to call .withRepository()
 * ```
 *
 * @param config - Global configuration options
 */
export function configureSagalicious(config: SagaliciousConfig): void {
  globalConfig = { ...config };
}

/**
 * Get the current global configuration.
 * @internal
 */
export function getGlobalConfig(): SagaliciousConfig {
  return globalConfig;
}

/**
 * Reset global configuration to empty state.
 * Useful for testing or when you need to clear configuration.
 *
 * @example
 * ```typescript
 * // In test teardown
 * afterEach(() => {
 *   resetGlobalConfig();
 * });
 * ```
 */
export function resetGlobalConfig(): void {
  globalConfig = {};
}
