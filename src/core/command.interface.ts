export interface Command {
  readonly type?: string;
  readonly metadata?: Record<string, any>;
}
