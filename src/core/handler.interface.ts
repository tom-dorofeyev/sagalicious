import { Command } from './command.interface';
import { Transaction } from './transaction.interface';

export interface HandlerConfig<TCommand extends Command = Command> {
  type: string;
  execute: (command: TCommand, transaction: Transaction) => Promise<void>;
  rollback: (command: TCommand, transaction: Transaction) => Promise<void>;
}

export function defineHandler<TCommand extends Command>(
  config: HandlerConfig<TCommand>,
): HandlerConfig<TCommand> {
  return config;
}
