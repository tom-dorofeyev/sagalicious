export { Command } from './core/command.interface';
export { CommandProcessor } from './core/processor.interface';
export {
  Transaction,
  TransactionStatus,
  TransactionOptions,
} from './core/transaction.interface';
export { TransactionRepository } from './core/repository.interface';
export {
  Saga,
  SagaConfig,
} from './core/saga';
export {
  SagaliciousError,
  NoProcessorFoundError,
} from './core/errors';

export { HandlerConfig, defineHandler } from './core/handler.interface';
export { HandlerAdapter } from './core/handler.adapter';
export {
  SagaBuilder,
  createSaga,
} from './core/saga.builder';

export {
  SagaliciousConfig,
  configureSagalicious,
  resetGlobalConfig,
} from './core/config';

export { InMemoryTransactionRepository } from './repositories/memory.repository';
