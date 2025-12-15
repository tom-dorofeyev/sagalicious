import { Transaction, TransactionStatus } from './transaction.interface';

export interface TransactionRepository {
  create(transaction: Transaction): Promise<void>;
  findByIdAndUpdate(id: string, updates: Partial<Transaction>): Promise<void>;
  findById(id: string): Promise<Transaction | null>;
  deleteById(id: string): Promise<void>;
  findByStatus(status: TransactionStatus): Promise<Transaction[]>;
}
