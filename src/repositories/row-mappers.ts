export function booleanFromSqlite(value: number): boolean {
  return value === 1;
}

export function booleanToSqlite(value: boolean): number {
  return value ? 1 : 0;
}
