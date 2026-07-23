"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../lib/auth";

/** 로그인 필수 페이지를 감싸 미인증 시 /login 으로 보낸다. */
export default function Guard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading) return <div className="spinner" />;
  if (!user) return null;
  return <>{children}</>;
}
