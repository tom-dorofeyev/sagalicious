import { randomUUID } from 'crypto';
import { Command } from './command.interface';
import { CommandProcessor } from './processor.interface';
import {
  Transaction,
  TransactionOptions,
  TransactionStatus,
} from './transaction.interface';
import { TransactionRepository } from './repository.interface';
import { NoProcessorFoundError } from './errors';

enum TransactionProcessAction {
  Commit = 'Commit',
  RollBack = 'RollBack',
}

export interface SagaConfig {
  processors: CommandProcessor[];
  repository?: TransactionRepository;
}

/**
 * Coordinates distributed transaction execution with automatic compensation on failure.
 *
 * @example
 * ```ts
 * const saga = new Saga({
 *   processors: [paymentProcessor, inventoryProcessor],
 *   repository: new InMemoryTransactionRepository()
 * });
 *
 * await saga.execute([
 *   { type: 'payment', amount: 100 },
 *   { type: 'inventory', itemId: 'item-123' }
 * ]);
 * ```
 */
export class Saga {
  private readonly processors: CommandProcessor[];
  private readonly repository?: TransactionRepository;

  constructor(config: SagaConfig) {
    this.processors = config.processors;
    this.repository = config.repository;
  }

  async initTransaction<TMetadata = any>(
    commands: Command[],
    options?: TransactionOptions<TMetadata>,
  ): Promise<Transaction<TMetadata>> {
    if (!commands || commands.length === 0) {
      throw new Error("Commands can't be null or empty");
    }

    const transaction: Transaction<TMetadata> = {
      id: options?.id || randomUUID(),
      status: TransactionStatus.Pending,
      commands,
      metadata: options?.metadata,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (this.repository) {
      await this.repository.create(transaction);
    }

    return transaction;
  }

  async commitTransaction(transaction: Transaction): Promise<void> {
    await this.processTransaction(transaction, TransactionProcessAction.Commit);

    transaction.status = TransactionStatus.Completed;
    transaction.updatedAt = new Date();

    if (this.repository) {
      await this.repository.findByIdAndUpdate(transaction.id, {
        status: TransactionStatus.Completed,
        updatedAt: transaction.updatedAt,
      });
    }
  }

  async rollBackTransaction(transaction: Transaction): Promise<void> {
    await this.processTransaction(
      transaction,
      TransactionProcessAction.RollBack,
    );

    transaction.status = TransactionStatus.RolledBack;
    transaction.updatedAt = new Date();

    if (this.repository) {
      await this.repository.findByIdAndUpdate(transaction.id, {
        status: TransactionStatus.RolledBack,
        updatedAt: transaction.updatedAt,
      });
    }
  }

  /**
   * Executes commands as a transaction with automatic rollback on failure.
   *
   * @throws {NoProcessorFoundError} When no processor can handle a command
   * @throws {Error} Original error after automatic rollback
   */
  async execute<TMetadata = any>(
    commands: Command[],
    options?: TransactionOptions<TMetadata>,
  ): Promise<Transaction<TMetadata>> {
    const transaction = await this.initTransaction(commands, options);

    try {
      await this.commitTransaction(transaction);
      return transaction;
    } catch (error) {
      await this.rollBackTransaction(transaction);
      throw error;
    }
  }

  private async processTransaction(
    transaction: Transaction,
    action: TransactionProcessAction,
  ): Promise<void> {
    if (!transaction.id) {
      throw new Error('Only initialized transactions can be processed');
    }

    const commands =
      action === TransactionProcessAction.RollBack
        ? [...transaction.commands].reverse()
        : transaction.commands;

    for (const command of commands) {
      const commandProcessor = this.processors.find((p) =>
        p.canProcess(command),
      );

      if (!commandProcessor) {
        throw new NoProcessorFoundError(command);
      }

      switch (action) {
        case TransactionProcessAction.Commit:
          await commandProcessor.process(command, transaction);
          break;
        case TransactionProcessAction.RollBack:
          await commandProcessor.rollBack(command, transaction);
          break;
        default:
          throw new Error('TransactionProcessAction must be provided');
      }
    }
  }
}
