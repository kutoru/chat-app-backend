export class Result<Value> {
  private _value?: Value;
  private _error?: string;

  private constructor(value?: Value, error?: string) {
    if (value !== undefined) {
      this._value = value as Value;
    } else {
      this._error = error as string;
    }
  }

  static Ok<T>(value: T): Result<T> {
    if (value === undefined) {
      throw new Error("Ok result can't have an undefined value");
    }

    return new Result(value, undefined);
  }

  static Err(error: string) {
    return new Result(undefined as never, error);
  }

  static try<T>(callback: () => T) {
    try {
      const result = callback();
      return this.Ok(result);
    } catch (error: any) {
      return this.Err(error.message ? error.message : `${error}`);
    }
  }

  static async tryAsync<T>(callback: () => Promise<T>): Promise<Result<T>> {
    try {
      const result = await callback();
      return this.Ok(result);
    } catch (error: any) {
      return this.Err(error.message ? error.message : `${error}`);
    }
  }

  ok(): this is Result<Value> {
    return this._value !== undefined;
  }

  err(): this is Result<never> {
    return this._error !== undefined;
  }

  value(): Value {
    if (this._value === undefined) {
      throw new Error("Attempted to get an undefined value");
    }

    return this._value;
  }

  error(): string {
    if (this._error === undefined) {
      throw new Error("Attempted to get an undefined error");
    }

    return this._error;
  }
}

export function Ok<T>(value: T) {
  return Result.Ok(value);
}

export function Err(error: string) {
  return Result.Err(error);
}
