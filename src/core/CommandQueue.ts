/**
 * CommandQueue.ts — Player-to-AI bridge for work orders.
 * Stores player-issued commands (mine, build_object) so characters can
 * pick them up as work tasks via the utility AI.
 */

export type CommandType = 'mine' | 'build_object' | 'build_tile';
export type CommandStatus = 'pending' | 'in_progress' | 'complete' | 'cancelled';

export interface Command {
  id: number;
  type: CommandType;
  tileX: number;
  tileY: number;
  objectName?: string;
  assignedTo: number | null;
  status: CommandStatus;
}

class CommandQueueClass {
  private commands: Map<number, Command> = new Map();
  private nextId = 1;

  /** Add a new command to the queue. Returns the command ID. */
  addCommand(type: CommandType, tileX: number, tileY: number, objectName?: string): number {
    // Check for duplicate command at same tile of same type
    for (const cmd of this.commands.values()) {
      if (cmd.type === type && cmd.tileX === tileX && cmd.tileY === tileY &&
          cmd.status !== 'complete' && cmd.status !== 'cancelled') {
        return cmd.id; // Already queued
      }
    }

    const id = this.nextId++;
    const cmd: Command = {
      id,
      type,
      tileX,
      tileY,
      objectName,
      assignedTo: null,
      status: 'pending',
    };
    this.commands.set(id, cmd);
    return id;
  }

  /** Get all available (pending) commands, optionally filtered by type. */
  getAvailable(type?: CommandType): Command[] {
    const result: Command[] = [];
    for (const cmd of this.commands.values()) {
      if (cmd.status !== 'pending') continue;
      if (type && cmd.type !== type) continue;
      result.push(cmd);
    }
    return result;
  }

  /** Get a command by ID. */
  get(id: number): Command | undefined {
    return this.commands.get(id);
  }

  /** Claim a command for a character. Returns true if successful. */
  claim(id: number, charId: number): boolean {
    const cmd = this.commands.get(id);
    if (!cmd || cmd.status !== 'pending') return false;
    cmd.assignedTo = charId;
    cmd.status = 'in_progress';
    return true;
  }

  /** Mark a command as complete and remove it. */
  complete(id: number) {
    const cmd = this.commands.get(id);
    if (cmd) {
      cmd.status = 'complete';
      this.commands.delete(id);
    }
  }

  /** Cancel a command. */
  cancel(id: number) {
    const cmd = this.commands.get(id);
    if (cmd) {
      cmd.status = 'cancelled';
      this.commands.delete(id);
    }
  }

  /** Release a claimed command back to pending (e.g. character died). */
  release(id: number) {
    const cmd = this.commands.get(id);
    if (cmd && cmd.status === 'in_progress') {
      cmd.assignedTo = null;
      cmd.status = 'pending';
    }
  }

  /** Get all non-complete/cancelled commands (for overlay rendering). */
  getAllActive(): Command[] {
    const result: Command[] = [];
    for (const cmd of this.commands.values()) {
      if (cmd.status !== 'complete' && cmd.status !== 'cancelled') {
        result.push(cmd);
      }
    }
    return result;
  }

  /** Clear all commands. */
  clear() {
    this.commands.clear();
    this.nextId = 1;
  }

  /** Get save data for all pending/in-progress commands. */
  getSaveData(): { type: CommandType; tileX: number; tileY: number; objectName?: string }[] {
    const result: { type: CommandType; tileX: number; tileY: number; objectName?: string }[] = [];
    for (const cmd of this.commands.values()) {
      if (cmd.status === 'pending' || cmd.status === 'in_progress') {
        result.push({ type: cmd.type, tileX: cmd.tileX, tileY: cmd.tileY, objectName: cmd.objectName });
      }
    }
    return result;
  }

  /** Load save data — restores commands as pending. */
  loadSaveData(data: { type: CommandType; tileX: number; tileY: number; objectName?: string }[]) {
    this.clear();
    for (const d of data) {
      this.addCommand(d.type, d.tileX, d.tileY, d.objectName);
    }
  }
}

/** Global singleton */
export const CommandQueue = new CommandQueueClass();
