export abstract class Entity<TId = string> {
  constructor(public readonly id: TId) {}

  equals(other: Entity<TId>): boolean {
    if (!(other instanceof Entity)) return false;
    return this.id === other.id;
  }
}
