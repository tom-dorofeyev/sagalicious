import { Command } from './command.interface';
import { Transaction } from './transaction.interface';

/**
 * Handles execution and compensation of specific command types.
 *
 * @example
 * ```ts
 * class PaymentProcessor implements CommandProcessor<PaymentCommand> {
 *   canProcess(command: Command): command is PaymentCommand {
 *     return command.type === 'payment';
 *   }
 *
 *   async process(command: PaymentCommand, transaction: Transaction) {
 *     await chargePayment(command.amount);
 *   }
 *
 *   async rollBack(command: PaymentCommand, transaction: Transaction) {
 *     await refundPayment(command.amount);
 *   }
 * }
 * ```
 */
export interface CommandProcessor<TCommand extends Command = Command> {
  canProcess(command: Command): command is TCommand;
  process(command: TCommand, transaction: Transaction): Promise<void>;
  rollBack(command: TCommand, transaction: Transaction): Promise<void>;
}
