# Sagalicious

> **Orchestration-based Saga pattern for TypeScript**
> Coordinate distributed transactions with automatic compensation

[![npm version](https://img.shields.io/npm/v/sagalicious.svg)](https://www.npmjs.com/package/sagalicious)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.1+-blue.svg)](https://www.typescriptlang.org/)

**Sagalicious** is a framework-agnostic TypeScript library that implements the **orchestration-based Saga pattern** for coordinating distributed transactions with automatic compensation on failure. Coordinate operations across databases, microservices, and APIs with type-safe rollback handlers.

## Why Sagalicious?

- **Type-safe** - Full TypeScript support with generics
- **Framework-agnostic** - Works with Express, NestJS, or any Node.js framework
- **Flexible** - Functional or class-based handler definitions
- **Persistent** - Optional transaction persistence with custom repositories
- **Battle-tested** - Implements proven distributed transaction patterns
- **Zero dependencies** - Lightweight and minimal

## Installation

```bash
npm install sagalicious
```

## Quick Start

```typescript
import { createSaga } from 'sagalicious';

const saga = createSaga()
  .handler('payment', {
    execute: async (cmd, tx) => {
      await stripe.charges.create({ amount: cmd.amount });
    },
    rollback: async (cmd, tx) => {
      await stripe.refunds.create({ charge: cmd.chargeId });
    }
  })
  .handler('inventory', {
    execute: async (cmd, tx) => {
      await db.inventory.reserve(cmd.itemId);
    },
    rollback: async (cmd, tx) => {
      await db.inventory.release(cmd.itemId);
    }
  })
  .build();

await saga.execute([
  { type: 'payment', amount: 100, chargeId: 'ch_123' },
  { type: 'inventory', itemId: 'item-456' }
]);
```

If any command fails, rollbacks run in reverse order automatically.

## The Saga Pattern

Sagalicious implements the **orchestration-based Saga pattern**, where a central coordinator (the saga) explicitly controls the flow of execution:

- **Sequential execution** - Commands execute in order, one after another
- **Central coordination** - The saga orchestrator manages all operations
- **Automatic compensation** - Failed transactions trigger rollbacks in reverse order
- **Predictable flow** - Easy to understand, debug, and test

This differs from the **choreography-based** approach where services listen to events and decide independently. Orchestration provides better visibility, simpler error handling, and centralized transaction logic—ideal for coordinating complex operations across multiple services or databases.

## Core Concepts

### Commands

Commands are plain objects that describe operations:

```typescript
interface Command {
  type?: string;
  metadata?: Record<string, any>;
}
```

### Handlers

Two ways to define handlers:

**Functional API** (recommended):

```typescript
createSaga()
  .handler('payment', {
    execute: async (cmd, tx) => { /* forward */ },
    rollback: async (cmd, tx) => { /* rollback */ }
  })
```

**Class-based API**:

```typescript
class PaymentProcessor implements CommandProcessor<PaymentCommand> {
  canProcess(command: Command): command is PaymentCommand {
    return command.type === 'payment';
  }

  async process(command: PaymentCommand, transaction: Transaction) {
    await chargePayment(command.amount);
  }

  async rollBack(command: PaymentCommand, transaction: Transaction) {
    await refundPayment(command.amount);
  }
}

createSaga()
  .processor(new PaymentProcessor())
```

### Transactions

Transactions track execution state:

```typescript
interface Transaction<TMetadata = any> {
  id: string;
  status: TransactionStatus;
  commands: Command[];
  metadata?: TMetadata;
  createdAt: Date;
  updatedAt: Date;
}

enum TransactionStatus {
  Pending = 'PENDING',
  Completed = 'COMPLETED',
  RolledBack = 'ROLLED_BACK'
}
```

## API Reference

### createSaga()

Creates a builder for configuring the saga.

```typescript
const saga = createSaga()
  .handler(type, config)      // Add functional handler
  .handler(config)            // Add handler with type in config
  .processor(processor)       // Add class-based processor
  .withRepository(repository) // Add persistence
  .build();
```

### saga.execute()

Executes commands with automatic rollback on failure:

```typescript
const transaction = await saga.execute(commands, options?);
```

**Parameters:**
- `commands: Command[]` - Commands to execute
- `options?: TransactionOptions<TMetadata>` - Optional configuration

**Returns:** `Transaction<TMetadata>` with status `Completed`

**Throws:** Original error after automatic rollback

### saga.initTransaction()

Initializes a transaction without executing:

```typescript
const transaction = await saga.initTransaction(commands, options?);
```

### saga.commitTransaction()

Executes all commands in forward order:

```typescript
await saga.commitTransaction(transaction);
```

### saga.rollBackTransaction()

Executes compensations in reverse order:

```typescript
await saga.rollBackTransaction(transaction);
```

## Persistence

### Global Configuration (Recommended)

Configure repository once at application startup:

```typescript
import { configureSagalicious, createSaga } from 'sagalicious';
import { MongoTransactionRepository } from './repositories/mongo';

// At app initialization
configureSagalicious({
  repository: new MongoTransactionRepository()
});

// All sagas automatically use the configured repository
const saga = createSaga()
  .handler('payment', { execute, rollback })
  .build();
```

### Per-Saga Configuration

Override global config for specific sagas:

```typescript
import { InMemoryTransactionRepository } from 'sagalicious';

const saga = createSaga()
  .handler('payment', { execute, rollback })
  .withRepository(new InMemoryTransactionRepository()) // Overrides global
  .build();
```

### Custom Repository

Implement `TransactionRepository` for your database:

```typescript
interface TransactionRepository {
  create(transaction: Transaction): Promise<void>;
  findByIdAndUpdate(id: string, updates: Partial<Transaction>): Promise<void>;
  findById(id: string): Promise<Transaction | null>;
  deleteById(id: string): Promise<void>;
  findByStatus(status: TransactionStatus): Promise<Transaction[]>;
}
```

## Transaction Metadata

Attach custom metadata to transactions:

```typescript
interface OrderMetadata {
  orderId: string;
  customerId: string;
}

const transaction = await saga.execute<OrderMetadata>(
  commands,
  {
    metadata: {
      orderId: 'order-123',
      customerId: 'customer-456'
    }
  }
);

console.log(transaction.metadata.orderId);
```

## Error Handling

```typescript
try {
  await saga.execute(commands);
} catch (error) {
  if (error instanceof NoProcessorFoundError) {
    console.error('No handler registered for command');
  } else {
    console.error('Transaction failed after rollback:', error);
  }
}
```

## Use Cases

**Multi-database transactions**
```typescript
createSaga()
  .handler('postgres', {
    execute: async (cmd) => await postgres.insert(cmd.data),
    rollback: async (cmd) => await postgres.delete(cmd.id)
  })
  .handler('mongodb', {
    execute: async (cmd) => await mongo.insertOne(cmd.data),
    rollback: async (cmd) => await mongo.deleteOne({ _id: cmd.id })
  })
```

**Microservices coordination (Saga pattern)**
```typescript
createSaga()
  .handler('order-service', {
    execute: async (cmd) => await orderService.create(cmd),
    rollback: async (cmd) => await orderService.cancel(cmd.orderId)
  })
  .handler('payment-service', {
    execute: async (cmd) => await paymentService.charge(cmd),
    rollback: async (cmd) => await paymentService.refund(cmd.chargeId)
  })
  .handler('notification-service', {
    execute: async (cmd) => await notify.send(cmd),
    rollback: async (cmd) => {} // Notifications don't need rollback
  })
```

**Mixed operations (DB + API + Events)**
```typescript
createSaga()
  .handler('database', {
    execute: async (cmd) => await db.users.create(cmd.user),
    rollback: async (cmd) => await db.users.delete(cmd.user.id)
  })
  .handler('stripe', {
    execute: async (cmd) => await stripe.customers.create(cmd.customer),
    rollback: async (cmd) => await stripe.customers.del(cmd.customerId)
  })
  .handler('webhook', {
    execute: async (cmd) => await webhooks.trigger('user.created', cmd),
    rollback: async (cmd) => await webhooks.trigger('user.deleted', cmd)
  })
```

## TypeScript

Full type safety with generics:

```typescript
interface PaymentCommand extends Command {
  type: 'payment';
  amount: number;
  currency: string;
}

class PaymentProcessor implements CommandProcessor<PaymentCommand> {
  canProcess(command: Command): command is PaymentCommand {
    return command.type === 'payment';
  }

  async process(command: PaymentCommand, transaction: Transaction) {
    // command is fully typed as PaymentCommand
    const charge = await stripe.charges.create({
      amount: command.amount,
      currency: command.currency
    });
  }

  async rollBack(command: PaymentCommand, transaction: Transaction) {
    await stripe.refunds.create({ charge: command.chargeId });
  }
}
```

## Testing

Mock handlers for testing:

```typescript
import { createSaga } from 'sagalicious';

const mockPayment = jest.fn();
const mockRefund = jest.fn();

const saga = createSaga()
  .handler('payment', {
    execute: mockPayment,
    rollback: mockRefund
  })
  .build();

await saga.execute([{ type: 'payment', amount: 100 }]);

expect(mockPayment).toHaveBeenCalledWith(
  { type: 'payment', amount: 100 },
  expect.objectContaining({ status: 'PENDING' })
);
```

## License

MIT
