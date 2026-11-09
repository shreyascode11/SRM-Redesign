import { Fragment } from "react";

const LATIN = /^[\x20-\x7e₹’'…]+$/;

/**
 * A display headline whose letters rise into place one after another ("rise", 620 ms, staggered).
 * Latin words are split into letters; Tamil and Devanagari move a whole word at a time, because splitting their
 * letters would break the script. The text stays plain in the DOM, so screen readers read it normally.
 * `onLoad` animates at once (the hero); otherwise GrailMotion starts it when the heading scrolls into view.
 */
export function Rise({
  as: Tag = "h2",
  text,
  id,
  className = "",
  onLoad = false,
  style,
}: {
  as?: "h1" | "h2" | "h3";
  text: string;
  id?: string;
  className?: string;
  onLoad?: boolean;
  style?: React.CSSProperties;
}) {
  let i = 0;
  const words = text.split(" ");
  return (
    <Tag id={id} style={style} data-rise={onLoad ? "load" : ""} className={`grail-display ${className}`}>
      {words.map((word, w) => (
        <Fragment key={w}>
          <span className="grail-word">
            {LATIN.test(word)
              ? [...word].map((ch, c) => (
                  <span key={c} className="grail-letter" style={{ "--i": i++ } as React.CSSProperties}>
                    {ch}
                  </span>
                ))
              : (
                  <span className="grail-letter" style={{ "--i": (i += 3) } as React.CSSProperties}>
                    {word}
                  </span>
                )}
          </span>
          {w < words.length - 1 ? " " : null}
        </Fragment>
      ))}
    </Tag>
  );
}
