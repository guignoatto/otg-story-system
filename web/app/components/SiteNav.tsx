"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Estúdio" },
  { href: "/clientes", label: "Clientes" },
];

export function SiteNav() {
  const pathname = usePathname();
  return (
    <nav className="app-nav" aria-label="Navegação principal">
      <Link href="/" className="brand-lockup" style={{ textDecoration: "none" }}>
        <Image
          className="brand-logo"
          src="/assets/otg-logo-horizontal.png"
          alt="OTG Mídia"
          width={128}
          height={56}
          priority
        />
      </Link>
      <div className="nav-links">
        {LINKS.map((link) => {
          const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
          return (
            <Link key={link.href} href={link.href} className={active ? "active" : ""}>
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
