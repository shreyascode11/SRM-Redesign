"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import { SmartLink } from "@/components/ui/SmartLink";
import { Link, usePathname } from "@/lib/i18n";
import { CommandPalette } from "./CommandPalette";
import { LanguageSwitcher } from "./LanguageSwitcher";
import type { NavData, NavSection } from "./types";
import srmLogo from "@/public/brand/srm-logo-white.png";

/**
 * Five-item header (UATX "few nav links") with Harvard-style progressive disclosure:
 * desktop = disclosure buttons opening one mega-panel at a time; mobile = full-screen <dialog> with accordions.
 * Uses the disclosure pattern, not ARIA menus — these are navigation links, not app commands.
 */
export function SiteHeader({ nav }: { nav: NavData }) {
  const pathname = usePathname();
  const [openId, setOpenId] = useState<NavSection["id"] | null>(null);
  const headerRef = useRef<HTMLElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const uid = useId();

  // Close the desktop panel on outside click or Escape (focus returns to its button).
  useEffect(() => {
    if (!openId) return;
    const onPointer = (e: PointerEvent) => {
      if (!headerRef.current?.contains(e.target as Node)) setOpenId(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      document.getElementById(`${uid}-btn-${openId}`)?.focus();
      setOpenId(null);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [openId, uid]);

  // ...and on route change.
  useEffect(() => {
    setOpenId(null);
    dialogRef.current?.close();
  }, [pathname]);

  const onLinkClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("a")) {
      setOpenId(null);
      dialogRef.current?.close();
    }
  };

  return (
    <header
      ref={headerRef}
      className="site-header sticky top-0 z-50 border-b border-line-subtle bg-bg text-fg"
      onBlur={(e) => {
        if (openId && !e.currentTarget.contains(e.relatedTarget as Node | null)) setOpenId(null);
      }}
    >
      <div className="site-container flex h-16 items-center gap-2 xl:gap-4">
        <Link href="/" aria-label={nav.labels.home} className="mr-auto flex min-h-11 shrink-0 items-center gap-2 text-fg no-underline">
          <Wordmark />
        </Link>

        <nav aria-label={nav.labels.primary} className="hidden xl:block" onClick={onLinkClick}>
          <ul className="flex items-center">
            {nav.sections.map((section) => {
              const open = openId === section.id;
              return (
                <li key={section.id}>
                  <button
                    id={`${uid}-btn-${section.id}`}
                    type="button"
                    aria-expanded={open}
                    aria-controls={`${uid}-panel-${section.id}`}
                    onClick={() => setOpenId(open ? null : section.id)}
                    className={`nav-label inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 font-medium whitespace-nowrap ${
                      open ? "bg-fg text-bg" : "hover:bg-line-subtle"
                    }`}
                  >
                    {section.label}
                    <Chevron open={open} />
                  </button>
                  <div
                    id={`${uid}-panel-${section.id}`}
                    hidden={!open}
                    className="absolute inset-x-0 top-full border-b border-line-subtle bg-bg shadow-2xl"
                  >
                    <MegaPanel section={section} externalHint={nav.labels.external} />
                  </div>
                </li>
              );
            })}
          </ul>
        </nav>

        <LanguageSwitcher label={nav.labels.language} compact className="hidden xl:block" />

        <CommandPalette nav={nav} />

        {/* The 3D campus game: always one tap away. */}
        <Link
          href={nav.play.href}
          className="hidden min-h-11 items-center gap-1.5 rounded-full border border-line px-4 font-semibold whitespace-nowrap text-fg no-underline hover:border-fg sm:inline-flex"
        >
          <span aria-hidden="true">🎮</span>
          {nav.play.label}
        </Link>

        <SmartLink
          href={nav.apply.href}
          externalHint={nav.labels.external}
          data-magnetic
          className="relative inline-flex min-h-11 items-center overflow-hidden rounded-full border-2 border-[var(--action-edge)] bg-action px-5 font-semibold whitespace-nowrap text-on-action no-underline"
        >
          {nav.labels.apply}
        </SmartLink>

        <button
          type="button"
          aria-haspopup="dialog"
          onClick={() => dialogRef.current?.showModal()}
          className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full px-3 font-medium xl:hidden"
        >
          <MenuIcon />
          {/* Icon-only below 400px in Tamil (its label squeezes the icon out); name stays for AT. See globals.css. */}
          <span className="menu-label">{nav.labels.menu}</span>
        </button>
      </div>

      <dialog
        ref={dialogRef}
        aria-label={nav.labels.primary}
        onClick={onLinkClick}
        className="m-0 h-dvh max-h-none w-full max-w-none overflow-y-auto bg-bg p-0 text-fg backdrop:bg-ink/60 xl:hidden"
      >
        <div className="site-container flex h-16 items-center justify-between border-b border-line-subtle">
          <Wordmark />
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full px-3 font-medium"
          >
            <CloseIcon />
            <span>{nav.labels.close}</span>
          </button>
        </div>
        <nav aria-label={nav.labels.primary} className="site-container py-4">
          <ul>
            {nav.sections.map((section) => (
              <MobileSection key={section.id} section={section} uid={uid} externalHint={nav.labels.external} />
            ))}
          </ul>
        </nav>
        <div className="site-container flex flex-col gap-4 pb-10">
          <LanguageSwitcher label={nav.labels.language} />
          <SmartLink
            href={nav.apply.href}
            externalHint={nav.labels.external}
            className="inline-flex min-h-12 items-center justify-center rounded-full border-2 border-[var(--action-edge)] bg-action px-6 text-lg font-semibold text-on-action no-underline"
          >
            {nav.apply.label}
          </SmartLink>
          <SmartLink
            href={nav.enquiry.href}
            className="inline-flex min-h-12 items-center justify-center rounded-full border border-line px-6 text-lg font-semibold text-fg no-underline"
          >
            {nav.enquiry.label}
          </SmartLink>
          <Link
            href={nav.play.href}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-line px-6 text-lg font-semibold text-fg no-underline"
          >
            <span aria-hidden="true">🎮</span>
            {nav.play.label}
          </Link>
        </div>
      </dialog>
    </header>
  );
}

function MegaPanel({ section, externalHint }: { section: NavSection; externalHint: string }) {
  return (
    <div className="site-grid gap-y-8 py-10">
      <p className="col-span-3 font-display text-2xl leading-tight font-medium text-fg">{section.intro}</p>
      <div className="col-span-6 grid grid-cols-2 gap-x-6 gap-y-8">
        {section.groups.map((group) => (
          <div key={group.title}>
            <h2 className="mb-2 text-sm font-semibold tracking-wide text-fg-muted uppercase">{group.title}</h2>
            <ul className={group.links.length > 6 ? "columns-2 gap-6" : ""}>
              {group.links.map((link) => (
                <li key={link.href} className="break-inside-avoid">
                  <SmartLink
                    href={link.href}
                    externalHint={externalHint}
                    className="inline-flex min-h-11 items-center text-fg underline-offset-4 hover:underline"
                  >
                    {link.label}
                  </SmartLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {section.feature ? (
        <SmartLink
          href={section.feature.href}
          externalHint={externalHint}
          className="col-span-3 flex flex-col justify-end gap-2 rounded-2xl border border-line-subtle p-6 text-fg no-underline hover:border-line"
        >
          <span className="text-sm font-semibold tracking-wide text-fg-muted uppercase">{section.feature.eyebrow}</span>
          <span className="font-display text-xl leading-snug font-bold">{section.feature.title}</span>
        </SmartLink>
      ) : null}
    </div>
  );
}

function MobileSection({ section, uid, externalHint }: { section: NavSection; uid: string; externalHint: string }) {
  const [open, setOpen] = useState(false);
  const panelId = `${uid}-m-${section.id}`;
  return (
    <li className="border-b border-line-subtle">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
        className="flex min-h-14 w-full items-center justify-between font-display text-2xl font-bold"
      >
        {section.label}
        <Chevron open={open} />
      </button>
      <div id={panelId} hidden={!open} className="pb-6">
        <p className="mb-4 text-fg-muted">{section.intro}</p>
        {section.groups.map((group) => (
          <div key={group.title} className="mb-4">
            <h2 className="text-sm font-semibold tracking-wide text-fg-muted uppercase">{group.title}</h2>
            <ul className="grid grid-cols-2 gap-x-4">
              {group.links.map((link) => (
                <li key={link.href}>
                  <SmartLink
                    href={link.href}
                    externalHint={externalHint}
                    className="inline-flex min-h-11 items-center text-fg"
                  >
                    {link.label}
                  </SmartLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </li>
  );
}

/** Text wordmark — the official emblem is SRM's to supply; we never trace it. */
/** SRM's official logo (white version from srmist.edu.in, rasterised from its 170 kB SVG; next/image serves ~10 kB).
    Decorative here: the link around it carries the accessible name. */
function Wordmark() {
  return <Image src={srmLogo} alt="" loading="eager" sizes="120px" className="h-9 w-auto sm:h-10" />;
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 12 12" className={`size-3 transition-transform ${open ? "rotate-180" : ""}`}>
      <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5 shrink-0">
      <path d="M3 6h14M3 14h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5">
      <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
