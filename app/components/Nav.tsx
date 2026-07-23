"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../lib/auth";

const LINKS = [
  { href: "/", label: "탐색" },
  { href: "/search", label: "검색" },
  { href: "/mypage/subscriptions", label: "내 구독" },
  { href: "/chat", label: "채팅" },
  { href: "/notifications", label: "알림" },
];

export default function Nav() {
  const pathname = usePathname();
  const { user, logout, loading } = useAuth();

  const onAuthPage = pathname === "/login" || pathname === "/signup";
  if (onAuthPage) return null;

  return (
    <nav className="nav">
      <Link href="/" className="brand">
        twogetter
      </Link>
      {user && (
        <div className="nav-links">
          {LINKS.map((l) => {
            const active =
              l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <Link key={l.href} href={l.href} className={active ? "active" : ""}>
                {l.label}
              </Link>
            );
          })}
        </div>
      )}
      <div className="nav-right">
        {loading ? null : user ? (
          <>
            <Link href="/mypage" title="마이페이지">
              <span className="avatar">{user.nickname?.[0] ?? "U"}</span>
            </Link>
            <button className="btn btn-sm btn-ghost" onClick={() => logout()}>
              로그아웃
            </button>
          </>
        ) : (
          <>
            <Link href="/login" className="btn btn-sm btn-ghost">
              로그인
            </Link>
            <Link href="/signup" className="btn btn-sm btn-primary">
              회원가입
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
