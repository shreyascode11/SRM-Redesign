import { isTodo, type OrTodo } from "@/lib/todo";

/**
 * Marks content we don't have a verified source for yet (never invent facts).
 * Dev: loud highlighted "TODO: …" so gaps are impossible to miss.
 * Production: renders the safe fallback (e.g. "Contact admissions") instead of a guess.
 */
type Props = {
  note: string;
  fallback?: React.ReactNode;
};

export function Todo({ note, fallback = null }: Props) {
  if (process.env.NODE_ENV === "production") return <>{fallback}</>;
  return (
    <mark className="rounded-sm bg-[#ffd400] px-1 font-mono text-[0.8em] text-ink outline-2 outline-dashed outline-ink">
      TODO: {note}
    </mark>
  );
}

/** Renders a verified value (optionally formatted) or, for a "TODO: …" value, the <Todo> marker. */
export function Fact<T>({
  value,
  format,
  fallback,
}: {
  value: OrTodo<T>;
  format?: (v: T) => React.ReactNode;
  fallback?: React.ReactNode;
}) {
  if (isTodo(value)) return <Todo note={value.slice(5).trim()} fallback={fallback} />;
  return <>{format ? format(value as T) : String(value)}</>;
}
