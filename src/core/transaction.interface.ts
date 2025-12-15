import { Command } from './command.interface';

export enum TransactionStatus {
  Pending = 'PENDING',
  Completed = 'COMPLETED',
  RolledBack = 'ROLLED_BACK',
}

export interface Transaction<TMetadata = any> {
  id: string;
  status: TransactionStatus;
  commands: Command[];
  metadata?: TMetadata;
  createdAt: Date;
  updatedAt: Date;
}

export interface TransactionOptions<TMetadata = any> {
  id?: string;
  metadata?: TMetadata;
}
