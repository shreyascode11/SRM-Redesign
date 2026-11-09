import type { ComponentProps } from "react";
import { Link } from "@/lib/i18n";

const isExternal = (href: string) => /^(https?:|tel:|mailto:)/.test(href);

type Props = Omit<ComponentProps<"a">, "href"> & {
  href: string;
  /** Screen-reader hint appended to off-site links, e.g. "(opens SRM site)". */
  externalHint?: string;
};

/** Locale-aware Link for internal paths; plain <a> (same tab, announced) for off-site, tel: and mailto:. */
export function SmartLink({ href, externalHint, children, ...rest }: Props) {
  if (isExternal(href)) {
    return (
      <a href={href} {...rest}>
        {children}
        {externalHint && href.startsWith("http") ? <span className="sr-only"> {externalHint}</span> : null}
      </a>
    );
  }
  return (
    <Link href={href} {...rest}>
      {children}
    </Link>
  );
}
