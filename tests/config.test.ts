import { configureSagalicious, resetGlobalConfig, createSaga } from '../src';
import { TransactionRepository } from '../src/core/repository.interface';
import { Command } from '../src/core/command.interface';
import { TransactionStatus } from '../src/core/transaction.interface';

describe('Global Configuration', () => {
  let mockRepository: jest.Mocked<TransactionRepository>;

  beforeEach(() => {
    resetGlobalConfig();
    mockRepository = {
      create: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      findById: jest.fn(),
      deleteById: jest.fn(),
      findByStatus: jest.fn(),
    };
  });

  afterEach(() => {
    resetGlobalConfig();
  });

  test('sagas use global repository when configured', async () => {
    configureSagalicious({
      repository: mockRepository,
    });

    const saga = createSaga()
      .handler('test', {
        execute: async () => {},
        rollback: async () => {},
      })
      .build();

    await saga.execute([{ type: 'test' } as Command]);

    expect(mockRepository.create).toHaveBeenCalled();
    expect(mockRepository.findByIdAndUpdate).toHaveBeenCalled();
  });

  test('withRepository overrides global configuration', async () => {
    const globalRepo: jest.Mocked<TransactionRepository> = {
      create: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      findById: jest.fn(),
      deleteById: jest.fn(),
      findByStatus: jest.fn(),
    };

    const localRepo: jest.Mocked<TransactionRepository> = {
      create: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      findById: jest.fn(),
      deleteById: jest.fn(),
      findByStatus: jest.fn(),
    };

    configureSagalicious({
      repository: globalRepo,
    });

    const saga = createSaga()
      .handler('test', {
        execute: async () => {},
        rollback: async () => {},
      })
      .withRepository(localRepo)
      .build();

    await saga.execute([{ type: 'test' } as Command]);

    expect(localRepo.create).toHaveBeenCalled();
    expect(globalRepo.create).not.toHaveBeenCalled();
  });

  test('saga works without repository when none configured', async () => {
    const saga = createSaga()
      .handler('test', {
        execute: async () => {},
        rollback: async () => {},
      })
      .build();

    const transaction = await saga.execute([{ type: 'test' } as Command]);

    expect(transaction.status).toBe(TransactionStatus.Completed);
  });

  test('resetGlobalConfig clears configuration', async () => {
    configureSagalicious({
      repository: mockRepository,
    });

    resetGlobalConfig();

    const saga = createSaga()
      .handler('test', {
        execute: async () => {},
        rollback: async () => {},
      })
      .build();

    await saga.execute([{ type: 'test' } as Command]);

    expect(mockRepository.create).not.toHaveBeenCalled();
  });

  test('multiple sagas share global repository', async () => {
    configureSagalicious({
      repository: mockRepository,
    });

    const saga1 = createSaga()
      .handler('test1', {
        execute: async () => {},
        rollback: async () => {},
      })
      .build();

    const saga2 = createSaga()
      .handler('test2', {
        execute: async () => {},
        rollback: async () => {},
      })
      .build();

    await saga1.execute([{ type: 'test1' } as Command]);
    await saga2.execute([{ type: 'test2' } as Command]);

    expect(mockRepository.create).toHaveBeenCalledTimes(2);
  });
});
