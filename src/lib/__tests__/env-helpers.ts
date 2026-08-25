export function unsetEnv(key: string): void {
  Reflect.deleteProperty(process.env, key);
}
