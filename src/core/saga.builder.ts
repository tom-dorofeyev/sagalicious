import { Command } from './command.interface';
import { Saga, SagaConfig } from './saga';
import { TransactionRepository } from './repository.interface';
import { HandlerConfig } from './handler.interface';
import { HandlerAdapter } from './handler.adapter';
import { CommandProcessor } from './processor.interface';
import { getGlobalConfig } from './config';

/**
 * Fluent API for building a Saga.
 *
 * @example
 * ```ts
 * const saga = createSaga()
 *   .handler('payment', {
 *     execute: async (cmd) => { ... },
 *     rollback: async (cmd) => { ... }
 *   })
 *   .processor(new CustomProcessor())
 *   .withRepository(new InMemoryTransactionRepository())
 *   .build();
 * ```
 */
export class SagaBuilder {
  private processors: CommandProcessor[] = [];
  private repository?: TransactionRepository;

  handler<TCommand extends Command>(
    type: string,
    config: Omit<HandlerConfig<TCommand>, 'type'>,
  ): this;

  handler<TCommand extends Command>(config: HandlerConfig<TCommand>): this;

  handler<TCommand extends Command>(
    typeOrConfig: string | HandlerConfig<TCommand>,
    config?: Omit<HandlerConfig<TCommand>, 'type'>,
  ): this {
    if (typeof typeOrConfig === 'string') {
      this.processors.push(
        new HandlerAdapter({
          type: typeOrConfig,
          execute: config!.execute,
          rollback: config!.rollback,
        }),
      );
    } else {
      this.processors.push(new HandlerAdapter(typeOrConfig));
    }

    return this;
  }

  processor(processor: CommandProcessor): this {
    this.processors.push(processor);
    return this;
  }

  withRepository(repository: TransactionRepository): this {
    this.repository = repository;
    return this;
  }

  build(): Saga {
    const globalConfig = getGlobalConfig();
    const config: SagaConfig = {
      processors: this.processors,
      repository: this.repository ?? globalConfig.repository,
    };

    return new Saga(config);
  }
}

export function createSaga(): SagaBuilder {
  return new SagaBuilder();
}
