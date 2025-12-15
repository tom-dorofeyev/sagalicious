import { TransactionRepository } from '../core/repository.interface';
import { Transaction, TransactionStatus } from '../core/transaction.interface';

/**
 * In-memory repository for testing or when persistence is not required.
 */
export class InMemoryTransactionRepository implements TransactionRepository {
  private transactions: Map<string, Transaction> = new Map();

  async create(transaction: Transaction): Promise<void> {
    this.transactions.set(transaction.id, { ...transaction });
  }

  async findByIdAndUpdate(id: string, updates: Partial<Transaction>): Promise<void> {
    const existing = this.transactions.get(id);
    if (!existing) {
      throw new Error(`Transaction ${id} not found`);
    }

    this.transactions.set(id, {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    });
  }

  async findById(id: string): Promise<Transaction | null> {
    const transaction = this.transactions.get(id);
    return transaction ? { ...transaction } : null;
  }

  async deleteById(id: string): Promise<void> {
    this.transactions.delete(id);
  }

  async findByStatus(status: TransactionStatus): Promise<Transaction[]> {
    const results: Transaction[] = [];
    for (const transaction of this.transactions.values()) {
      if (transaction.status === status) {
        results.push({ ...transaction });
      }
    }
    return results;
  }

  clear(): void {
    this.transactions.clear();
  }

  size(): number {
    return this.transactions.size;
  }
}
