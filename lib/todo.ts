/**
 * Unverified values are strings starting with "TODO:" (never invent facts).
 * Kept free of content imports so client components can use it without bundling content JSON.
 */
export type Todo = `TODO:${string}`;
export type OrTodo<T> = T | Todo;

export function isTodo(value: unknown): value is Todo {
  return typeof value === "string" && value.startsWith("TODO:");
}

