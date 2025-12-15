import { createSaga, SagaBuilder } from '../src/core/saga.builder';
import { Command } from '../src/core/command.interface';
import { TransactionStatus } from '../src/core/transaction.interface';
import { TransactionRepository } from '../src/core/repository.interface';

interface PaymentCommand extends Command {
  type: 'payment';
  amount: number;
}

interface RefundCommand extends Command {
  type: 'refund';
  refundId: string;
}

describe('SagaBuilder', () => {
  describe('createSaga', () => {
    test('returns new SagaBuilder instance', () => {
      const builder = createSaga();

      expect(builder).toBeInstanceOf(SagaBuilder);
    });
  });

  describe('handler with type and config', () => {
    test('builds saga that executes handler for matching command type', async () => {
      let capturedStatus: TransactionStatus | undefined;
      const executeFn = jest.fn(async (_cmd, tx) => {
        capturedStatus = tx.status;
      });
      const saga = createSaga()
        .handler('payment', {
          execute: executeFn,
          rollback: async () => {},
        })
        .build();

      await saga.execute([{ type: 'payment', amount: 100 } as PaymentCommand]);

      expect(executeFn).toHaveBeenCalledWith(
        { type: 'payment', amount: 100 },
        expect.any(Object),
      );
      expect(capturedStatus).toBe(TransactionStatus.Pending);
    });

    test('builds saga that calls rollback when execution fails', async () => {
      const rollbackFn = jest.fn();
      const saga = createSaga()
        .handler('payment', {
          execute: async () => {
            throw new Error('Payment failed');
          },
          rollback: rollbackFn,
        })
        .build();

      await expect(saga.execute([{ type: 'payment', amount: 100 } as PaymentCommand])).rejects.toThrow('Payment failed');

      expect(rollbackFn).toHaveBeenCalledWith(
        { type: 'payment', amount: 100 },
        expect.objectContaining({ status: TransactionStatus.RolledBack }),
      );
    });

    test('builds saga with multiple handlers for different types', async () => {
      const paymentExecute = jest.fn();
      const refundExecute = jest.fn();

      const saga = createSaga()
        .handler('payment', {
          execute: paymentExecute,
          rollback: async () => {},
        })
        .handler('refund', {
          execute: refundExecute,
          rollback: async () => {},
        })
        .build();

      await saga.execute([
        { type: 'payment', amount: 100 } as PaymentCommand,
        { type: 'refund', refundId: 'ref-123' } as RefundCommand,
      ]);

      expect(paymentExecute).toHaveBeenCalledWith(
        { type: 'payment', amount: 100 },
        expect.any(Object),
      );
      expect(refundExecute).toHaveBeenCalledWith(
        { type: 'refund', refundId: 'ref-123' },
        expect.any(Object),
      );
    });

    test('allows method chaining', () => {
      const builder = createSaga();

      const result = builder.handler('payment', {
        execute: async () => {},
        rollback: async () => {},
      });

      expect(result).toBe(builder);
    });
  });

  describe('processor', () => {
    test('builds saga that uses processor for command matching', async () => {
      let capturedStatus: TransactionStatus | undefined;
      const processFn = jest.fn(async (_cmd, tx) => {
        capturedStatus = tx.status;
      });
      const customProcessor = {
        canProcess: (cmd: Command): cmd is PaymentCommand => cmd.type === 'payment',
        process: processFn,
        rollBack: async () => {},
      };

      const saga = createSaga().processor(customProcessor).build();

      await saga.execute([{ type: 'payment', amount: 100 } as PaymentCommand]);

      expect(processFn).toHaveBeenCalledWith(
        { type: 'payment', amount: 100 },
        expect.any(Object),
      );
      expect(capturedStatus).toBe(TransactionStatus.Pending);
    });

    test('builds saga with multiple processors', async () => {
      const paymentProcess = jest.fn();
      const refundProcess = jest.fn();

      const paymentProcessor = {
        canProcess: (cmd: Command): cmd is PaymentCommand => cmd.type === 'payment',
        process: paymentProcess,
        rollBack: async () => {},
      };

      const refundProcessor = {
        canProcess: (cmd: Command): cmd is RefundCommand => cmd.type === 'refund',
        process: refundProcess,
        rollBack: async () => {},
      };

      const saga = createSaga().processor(paymentProcessor).processor(refundProcessor).build();

      await saga.execute([
        { type: 'payment', amount: 100 } as PaymentCommand,
        { type: 'refund', refundId: 'ref-123' } as RefundCommand,
      ]);

      expect(paymentProcess).toHaveBeenCalled();
      expect(refundProcess).toHaveBeenCalled();
    });
  });

  describe('withRepository', () => {
    test('builds saga that persists transaction creation', async () => {
      const repository: jest.Mocked<TransactionRepository> = {
        create: jest.fn(),
        findByIdAndUpdate: jest.fn(),
        findById: jest.fn(),
        deleteById: jest.fn(),
        findByStatus: jest.fn(),
      };

      const saga = createSaga()
        .handler('payment', {
          execute: async () => {},
          rollback: async () => {},
        })
        .withRepository(repository)
        .build();

      await saga.execute([{ type: 'payment', amount: 100 } as PaymentCommand]);

      expect(repository.create).toHaveBeenCalledTimes(1);
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          commands: [{ type: 'payment', amount: 100 }],
        }),
      );
    });

    test('builds saga that persists transaction completion', async () => {
      const repository: jest.Mocked<TransactionRepository> = {
        create: jest.fn(),
        findByIdAndUpdate: jest.fn(),
        findById: jest.fn(),
        deleteById: jest.fn(),
        findByStatus: jest.fn(),
      };

      const saga = createSaga()
        .handler('payment', {
          execute: async () => {},
          rollback: async () => {},
        })
        .withRepository(repository)
        .build();

      await saga.execute([{ type: 'payment', amount: 100 } as PaymentCommand]);

      expect(repository.findByIdAndUpdate).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          status: TransactionStatus.Completed,
        }),
      );
    });
  });

  describe('build', () => {
    test('creates independent saga instances from same builder configuration', () => {
      const builder = createSaga().handler('payment', {
        execute: async () => {},
        rollback: async () => {},
      });

      const firstSaga = builder.build();
      const secondSaga = builder.build();

      expect(firstSaga).not.toBe(secondSaga);
    });
  });

  describe('builder composition', () => {
    test('combines handlers and processors in single saga', async () => {
      const handlerExecute = jest.fn();
      const processorProcess = jest.fn();

      const processor = {
        canProcess: (cmd: Command): cmd is RefundCommand => cmd.type === 'refund',
        process: processorProcess,
        rollBack: async () => {},
      };

      const saga = createSaga()
        .handler('payment', {
          execute: handlerExecute,
          rollback: async () => {},
        })
        .processor(processor)
        .build();

      await saga.execute([
        { type: 'payment', amount: 100 } as PaymentCommand,
        { type: 'refund', refundId: 'ref-123' } as RefundCommand,
      ]);

      expect(handlerExecute).toHaveBeenCalled();
      expect(processorProcess).toHaveBeenCalled();
    });

    test('applies handlers and processors with repository', async () => {
      const repository: jest.Mocked<TransactionRepository> = {
        create: jest.fn(),
        findByIdAndUpdate: jest.fn(),
        findById: jest.fn(),
        deleteById: jest.fn(),
        findByStatus: jest.fn(),
      };

      const executeFn = jest.fn();
      const saga = createSaga()
        .handler('payment', {
          execute: executeFn,
          rollback: async () => {},
        })
        .withRepository(repository)
        .build();

      await saga.execute([{ type: 'payment', amount: 100 } as PaymentCommand]);

      expect(executeFn).toHaveBeenCalled();
      expect(repository.create).toHaveBeenCalled();
      expect(repository.findByIdAndUpdate).toHaveBeenCalled();
    });

    test('maintains handler registration order', async () => {
      const executionOrder: string[] = [];

      const saga = createSaga()
        .handler('first', {
          execute: async () => {
            executionOrder.push('first');
          },
          rollback: async () => {},
        })
        .handler('second', {
          execute: async () => {
            executionOrder.push('second');
          },
          rollback: async () => {},
        })
        .handler('third', {
          execute: async () => {
            executionOrder.push('third');
          },
          rollback: async () => {},
        })
        .build();

      await saga.execute([{ type: 'first' }, { type: 'second' }, { type: 'third' }]);

      expect(executionOrder).toEqual(['first', 'second', 'third']);
    });
  });
});
