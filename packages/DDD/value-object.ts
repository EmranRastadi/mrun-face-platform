export abstract class ValueObject<TProps extends Record<string, unknown>> {
  protected constructor(public readonly props: Readonly<TProps>) {
    Object.freeze(this.props);
  }

  equals(other: ValueObject<TProps>): boolean {
    return JSON.stringify(this.props) === JSON.stringify(other.props);
  }
}
