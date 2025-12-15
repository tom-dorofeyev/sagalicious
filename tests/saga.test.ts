import { Saga } from '../src/core/saga';
import { Command } from '../src/core/command.interface';
import { CommandProcessor } from '../src/core/processor.interface';
import { Transaction, TransactionStatus } from '../src/core/transaction.interface';
import { TransactionRepository } from '../src/core/repository.interface';
import { NoProcessorFoundError } from '../src/core/errors';

interface TestCommand extends Command {
  type: 'test-command';
  value: string;
}

interface OrderMetadata {
  orderId: string;
  customerId: string;
}

class TestProcessor<T extends Command = Command> implements CommandProcessor<T> {
  private readonly predicate: (command: Command) => boolean;
  readonly process = jest.fn<Promise<void>, [T, Transaction]>();
  readonly rollBack = jest.fn<Promise<void>, [T, Transaction]>();
  readonly canProcessSpy = jest.fn<boolean, [Command]>();

  constructor(predicate: (command: Command) => boolean) {
    this.predicate = predicate;
  }

  canProcess(command: Command): command is T {
    const result = this.predicate(command);
    this.canProcessSpy(command);
    return result;
  }
}

describe('Saga', () => {
  let processor: TestProcessor<TestCommand>;
  let repository: jest.Mocked<TransactionRepository>;

  beforeEach(() => {
    processor = new TestProcessor<TestCommand>(() => true);

    repository = {
      create: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      findById: jest.fn(),
      deleteById: jest.fn(),
      findByStatus: jest.fn(),
    };
  });

  describe('initTransaction', () => {
    test('creates transaction with custom ID when provided in options', async () => {
      const saga = new Saga({ processors: [processor] });
      const commands: TestCommand[] = [{ type: 'test-command', value: 'test' }];
      const customId = 'custom-transaction-id';

      const transaction = await saga.initTransaction(commands, { id: customId });

      expect(transaction.id).toBe(customId);
    });

    test('initializes transaction in Pending status', async () => {
      const saga = new Saga({ processors: [processor] });
      const commands: TestCommand[] = [{ type: 'test-command', value: 'test' }];

      const transaction = await saga.initTransaction(commands);

      expect(transaction.status).toBe(TransactionStatus.Pending);
    });

    test('stores provided commands in transaction', async () => {
      const saga = new Saga({ processors: [processor] });
      const commands: TestCommand[] = [
        { type: 'test-command', value: 'first' },
        { type: 'test-command', value: 'second' },
      ];

      const transaction = await saga.initTransaction(commands);

      expect(transaction.commands).toEqual(commands);
    });

    test('stores provided metadata in transaction', async () => {
      const saga = new Saga({ processors: [processor] });
      const commands: TestCommand[] = [{ type: 'test-command', value: 'test' }];
      const metadata: OrderMetadata = { orderId: 'order-123', customerId: 'customer-456' };

      const transaction = await saga.initTransaction<OrderMetadata>(commands, { metadata });

      expect(transaction.metadata).toEqual(metadata);
    });

    test('persists transaction when repository is configured', async () => {
      const saga = new Saga({
        processors: [processor],
        repository,
      });
      const commands: TestCommand[] = [{ type: 'test-command', value: 'test' }];

      const transaction = await saga.initTransaction(commands);

      const persistedTransaction = repository.create.mock.calls[0][0];
      expect(persistedTransaction.id).toBe(transaction.id);
      expect(persistedTransaction.status).toBe(TransactionStatus.Pending);
    });

    test('rejects empty commands array', async () => {
      const saga = new Saga({ processors: [processor] });

      await expect(saga.initTransaction([])).rejects.toThrow("Commands can't be null or empty");
    });

    test('rejects null commands', async () => {
      const saga = new Saga({ processors: [processor] });

      await expect(saga.initTransaction(null as unknown as Command[])).rejects.toThrow(
        "Commands can't be null or empty",
      );
    });
  });

  describe('commitTransaction', () => {
    test('executes commands in forward sequential order', async () => {
      const saga = new Saga({ processors: [processor] });
      const commands: TestCommand[] = [
        { type: 'test-command', value: 'first' },
        { type: 'test-command', value: 'second' },
        { type: 'test-command', value: 'third' },
      ];
      const transaction = await saga.initTransaction(commands);

      await saga.commitTransaction(transaction);

      expect(processor.process).toHaveBeenNthCalledWith(1, commands[0], transaction);
      expect(processor.process).toHaveBeenNthCalledWith(2, commands[1], transaction);
      expect(processor.process).toHaveBeenNthCalledWith(3, commands[2], transaction);
    });

    test('transitions transaction status to Completed after successful commit', async () => {
      const saga = new Saga({ processors: [processor] });
      const commands: TestCommand[] = [{ type: 'test-command', value: 'test' }];
      const transaction = await saga.initTransaction(commands);

      await saga.commitTransaction(transaction);

      expect(transaction.status).toBe(TransactionStatus.Completed);
    });

    test('updates transaction timestamp after commit', async () => {
      const saga = new Saga({ processors: [processor] });
      const commands: TestCommand[] = [{ type: 'test-command', value: 'test' }];
      const transaction = await saga.initTransaction(commands);
      const originalUpdatedAt = transaction.updatedAt;

      await new Promise((resolve) => setTimeout(resolve, 10));
      await saga.commitTransaction(transaction);

      expect(transaction.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });

    test('persists Completed status when repository is configured', async () => {
      const saga = new Saga({
        processors: [processor],
        repository,
      });
      const commands: TestCommand[] = [{ type: 'test-command', value: 'test' }];
      const transaction = await saga.initTransaction(commands);

      await saga.commitTransaction(transaction);

      const updateCall = repository.findByIdAndUpdate.mock.calls[0];
      expect(updateCall[1].status).toBe(TransactionStatus.Completed);
    });

    test('rejects commit when no processor handles command', async () => {
      const rejectingProcessor = new TestProcessor<TestCommand>(() => false);
      const saga = new Saga({ processors: [rejectingProcessor] });
      const commands: TestCommand[] = [{ type: 'test-command', value: 'test' }];
      const transaction = await saga.initTransaction(commands);

      await expect(saga.commitTransaction(transaction)).rejects.toThrow(NoProcessorFoundError);
    });

    test('selects first matching processor when multiple processors can handle command', async () => {
      const firstProcessor = new TestProcessor(() => true);
      const secondProcessor = new TestProcessor(() => true);
      const saga = new Saga({
        processors: [firstProcessor, secondProcessor],
      });
      const commands: TestCommand[] = [{ type: 'test-command', value: 'test' }];
      const transaction = await saga.initTransaction(commands);

      await saga.commitTransaction(transaction);

      expect(firstProcessor.process).toHaveBeenCalled();
      expect(secondProcessor.process).not.toHaveBeenCalled();
    });

    test('rejects commit when transaction has no ID', async () => {
      const saga = new Saga({ processors: [processor] });
      const uninitializedTransaction = {
        status: TransactionStatus.Pending,
        commands: [{ type: 'test-command', value: 'test' }] as TestCommand[],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any;

      await expect(saga.commitTransaction(uninitializedTransaction)).rejects.toThrow(
        'Only initialized transactions can be processed',
      );
    });
  });

  describe('rollBackTransaction', () => {
    test('executes compensations in reverse sequential order', async () => {
      const saga = new Saga({ processors: [processor] });
      const commands: TestCommand[] = [
        { type: 'test-command', value: 'first' },
        { type: 'test-command', value: 'second' },
        { type: 'test-command', value: 'third' },
      ];
      const transaction = await saga.initTransaction(commands);

      await saga.rollBackTransaction(transaction);

      expect(processor.rollBack).toHaveBeenNthCalledWith(1, commands[2], transaction);
      expect(processor.rollBack).toHaveBeenNthCalledWith(2, commands[1], transaction);
      expect(processor.rollBack).toHaveBeenNthCalledWith(3, commands[0], transaction);
    });

    test('transitions transaction status to RolledBack after rollback', async () => {
      const saga = new Saga({ processors: [processor] });
      const commands: TestCommand[] = [{ type: 'test-command', value: 'test' }];
      const transaction = await saga.initTransaction(commands);

      await saga.rollBackTransaction(transaction);

      expect(transaction.status).toBe(TransactionStatus.RolledBack);
    });

    test('updates transaction timestamp after rollback', async () => {
      const saga = new Saga({ processors: [processor] });
      const commands: TestCommand[] = [{ type: 'test-command', value: 'test' }];
      const transaction = await saga.initTransaction(commands);
      const originalUpdatedAt = transaction.updatedAt;

      await new Promise((resolve) => setTimeout(resolve, 10));
      await saga.rollBackTransaction(transaction);

      expect(transaction.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });

    test('persists RolledBack status when repository is configured', async () => {
      const saga = new Saga({
        processors: [processor],
        repository,
      });
      const commands: TestCommand[] = [{ type: 'test-command', value: 'test' }];
      const transaction = await saga.initTransaction(commands);

      await saga.rollBackTransaction(transaction);

      const updateCall = repository.findByIdAndUpdate.mock.calls[0];
      expect(updateCall[1].status).toBe(TransactionStatus.RolledBack);
    });

    test('rejects rollback when no processor handles command', async () => {
      const rejectingProcessor = new TestProcessor<TestCommand>(() => false);
      const saga = new Saga({ processors: [rejectingProcessor] });
      const commands: TestCommand[] = [{ type: 'test-command', value: 'test' }];
      const transaction = await saga.initTransaction(commands);

      await expect(saga.rollBackTransaction(transaction)).rejects.toThrow(NoProcessorFoundError);
    });
  });

  describe('execute', () => {
    test('completes transaction when all commands succeed', async () => {
      const saga = new Saga({ processors: [processor] });
      const commands: TestCommand[] = [
        { type: 'test-command', value: 'first' },
        { type: 'test-command', value: 'second' },
      ];

      const transaction = await saga.execute(commands);

      expect(transaction.status).toBe(TransactionStatus.Completed);
      expect(transaction.commands).toEqual(commands);
    });

    test('automatically rolls back transaction when command execution fails', async () => {
      processor.process.mockRejectedValueOnce(new Error('Command execution failed'));
      const saga = new Saga({
        processors: [processor],
        repository,
      });
      const commands: TestCommand[] = [{ type: 'test-command', value: 'test' }];

      await expect(saga.execute(commands)).rejects.toThrow('Command execution failed');

      expect(processor.rollBack).toHaveBeenCalled();
      expect(repository.findByIdAndUpdate).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          status: TransactionStatus.RolledBack,
        }),
      );
    });

    test('propagates original error after automatic rollback', async () => {
      const originalError = new Error('Database connection lost');
      processor.process.mockRejectedValueOnce(originalError);
      const saga = new Saga({ processors: [processor] });
      const commands: TestCommand[] = [{ type: 'test-command', value: 'test' }];

      await expect(saga.execute(commands)).rejects.toThrow(originalError);
    });

    test('preserves transaction metadata throughout execution', async () => {
      const saga = new Saga({ processors: [processor] });
      const commands: TestCommand[] = [{ type: 'test-command', value: 'test' }];
      const metadata: OrderMetadata = { orderId: 'order-123', customerId: 'customer-456' };

      const transaction = await saga.execute<OrderMetadata>(commands, { metadata });

      expect(transaction.metadata).toEqual(metadata);
    });

    test('rolls back all commands in reverse order when execution fails partway through', async () => {
      const saga = new Saga({ processors: [processor] });
      const commands: TestCommand[] = [
        { type: 'test-command', value: 'first' },
        { type: 'test-command', value: 'second' },
        { type: 'test-command', value: 'third' },
      ];

      processor.process
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Third command failed'));

      await expect(saga.execute(commands)).rejects.toThrow('Third command failed');

      expect(processor.rollBack).toHaveBeenCalledTimes(3);
      expect(processor.rollBack).toHaveBeenNthCalledWith(1, commands[2], expect.any(Object));
      expect(processor.rollBack).toHaveBeenNthCalledWith(2, commands[1], expect.any(Object));
      expect(processor.rollBack).toHaveBeenNthCalledWith(3, commands[0], expect.any(Object));
    });
  });

  describe('processor routing', () => {
    test('routes commands to appropriate processor based on command type', async () => {
      interface PaymentCommand extends Command {
        type: 'payment';
        amount: number;
      }

      interface InventoryCommand extends Command {
        type: 'inventory';
        itemId: string;
      }

      const paymentProcessor = new TestProcessor<PaymentCommand>((cmd) => cmd.type === 'payment');
      const inventoryProcessor = new TestProcessor<InventoryCommand>((cmd) => cmd.type === 'inventory');

      const saga = new Saga({
        processors: [paymentProcessor, inventoryProcessor],
      });

      const commands: Command[] = [
        { type: 'payment', amount: 100 } as PaymentCommand,
        { type: 'inventory', itemId: 'item-123' } as InventoryCommand,
      ];
      const transaction = await saga.initTransaction(commands);

      await saga.commitTransaction(transaction);

      expect(paymentProcessor.process).toHaveBeenCalledWith(commands[0], transaction);
      expect(inventoryProcessor.process).toHaveBeenCalledWith(commands[1], transaction);
    });
  });
});
