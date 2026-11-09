/**
 * Unverified values are strings starting with "TODO:" (never invent facts).
 * Kept free of content imports so client components can use it without bundling content JSON.
 */
export type Todo = `TODO:${string}`;
export type OrTodo<T> = T | Todo;

export function isTodo(value: unknown): value is Todo {
  return typeof value === "string" && value.startsWith("TODO:");
}

/** The verified value, or null when it's still a TODO. */
export function verified<T>(value: OrTodo<T>): T | null {
  return isTodo(value) ? null : (value as T);
}
