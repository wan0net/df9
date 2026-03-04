import { TileGrid } from './TileGrid';
import { TileType } from './TileTypes';
import { CommandQueue } from '../core/CommandQueue';

/**
 * Auto-generate wall tiles at floor/space boundaries.
 *
 * The original Lua uses all 8 neighbors (diagonal + cardinal) when placing
 * walls around floor tiles.  Diagonal neighbors share an edge in the iso
 * diamond grid; cardinal neighbors (N/S at y±2, E/W at x±1) share a vertex.
 * Including cardinal neighbors produces corner wall sprites at diamond
 * vertices, matching the original game's appearance.
 */
export class WallAutoGen {
  private grid: TileGrid;

  constructor(grid: TileGrid) {
    this.grid = grid;
  }

  /** Recalculate walls around changed tiles (creates AND removes walls). */
  update(changedTiles: { x: number; y: number }[]) {
    // Collect all tiles that might need wall updates
    const candidates = new Set<string>();

    for (const t of changedTiles) {
      // The tile itself and all its neighbors could need updating
      candidates.add(`${t.x},${t.y}`);
      for (const n of this.grid.getAllNeighbors(t.x, t.y)) {
        candidates.add(`${n.x},${n.y}`);
      }
    }

    for (const key of candidates) {
      const [x, y] = key.split(',').map(Number);
      const current = this.grid.get(x, y);

      if (current === TileType.FLOOR || current === TileType.DOOR ||
          current === TileType.FLOOR_PENDING || current === TileType.WALL_PENDING) {
        continue; // Don't overwrite floors, doors, or pending tiles
      }

      // Check if this tile should be a wall (borders a floor in any direction)
      const neighbors = this.grid.getAllNeighbors(x, y);
      const bordersFloor = neighbors.some(
        n => {
          const nt = this.grid.get(n.x, n.y);
          return nt === TileType.FLOOR || nt === TileType.DOOR || nt === TileType.FLOOR_PENDING;
        }
      );

      if (bordersFloor && current === TileType.SPACE) {
        this.grid.set(x, y, TileType.WALL);
      } else if (!bordersFloor && current === TileType.WALL) {
        this.grid.set(x, y, TileType.SPACE);
      }
    }
  }

  /** Place PENDING walls around pending floor tiles (for room build mode). */
  updatePending(changedTiles: { x: number; y: number }[]) {
    const candidates = new Set<string>();

    for (const t of changedTiles) {
      candidates.add(`${t.x},${t.y}`);
      for (const n of this.grid.getAllNeighbors(t.x, t.y)) {
        candidates.add(`${n.x},${n.y}`);
      }
    }

    for (const key of candidates) {
      const [x, y] = key.split(',').map(Number);
      const current = this.grid.get(x, y);

      // Don't overwrite existing real or pending tiles
      if (current !== TileType.SPACE) continue;

      // Check if this space tile borders a pending floor
      const neighbors = this.grid.getAllNeighbors(x, y);
      const bordersPendingFloor = neighbors.some(
        n => this.grid.get(n.x, n.y) === TileType.FLOOR_PENDING
      );

      if (bordersPendingFloor) {
        this.grid.set(x, y, TileType.WALL_PENDING);
        CommandQueue.addCommand('build_tile', x, y, 'wall');
      }
    }
  }

  /**
   * Only remove orphaned walls (walls no longer adjacent to any floor).
   * Does NOT create new walls. Used by demolish to avoid spawning walls
   * in newly exposed spaces.
   */
  cleanupOrphans(changedTiles: { x: number; y: number }[]) {
    const candidates = new Set<string>();

    for (const t of changedTiles) {
      candidates.add(`${t.x},${t.y}`);
      for (const n of this.grid.getAllNeighbors(t.x, t.y)) {
        candidates.add(`${n.x},${n.y}`);
      }
    }

    for (const key of candidates) {
      const [x, y] = key.split(',').map(Number);
      const current = this.grid.get(x, y);

      // Only process WALL or WALL_PENDING tiles — remove if no adjacent floor
      if (current !== TileType.WALL && current !== TileType.WALL_PENDING) continue;

      const neighbors = this.grid.getAllNeighbors(x, y);
      const bordersFloor = neighbors.some(
        n => {
          const nt = this.grid.get(n.x, n.y);
          return nt === TileType.FLOOR || nt === TileType.DOOR ||
                 nt === TileType.FLOOR_PENDING;
        }
      );

      if (!bordersFloor) {
        this.grid.set(x, y, TileType.SPACE);
      }
    }
  }
}
