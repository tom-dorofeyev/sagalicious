import { Command } from './command.interface';
import { CommandProcessor } from './processor.interface';
import { Transaction } from './transaction.interface';
import { HandlerConfig } from './handler.interface';

export class HandlerAdapter<TCommand extends Command = Command>
  implements CommandProcessor<TCommand>
{
  constructor(private readonly config: HandlerConfig<TCommand>) {}

  canProcess(command: Command): command is TCommand {
    return command.type === this.config.type;
  }

  async process(command: TCommand, transaction: Transaction): Promise<void> {
    return this.config.execute(command, transaction);
  }

  async rollBack(command: TCommand, transaction: Transaction): Promise<void> {
    return this.config.rollback(command, transaction);
  }
}
