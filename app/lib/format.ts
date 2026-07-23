export function won(n: number | null | undefined): string {
  if (n == null) return "-";
  return n.toLocaleString("ko-KR") + "원";
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso).getTime();
  if (isNaN(d)) return "";
  const s = Math.floor((Date.now() - d) / 1000);
  if (s < 60) return "방금 전";
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  if (s < 604800) return `${Math.floor(s / 86400)}일 전`;
  return formatDate(iso);
}

export function subscriptionStatusLabel(status: string): {
  label: string;
  cls: string;
} {
  switch (status) {
    case "ACTIVE":
      return { label: "이용 중", cls: "badge-active" };
    case "PENDING":
      return { label: "결제 대기", cls: "badge-pending" };
    case "PAUSED":
      return { label: "일시정지", cls: "badge-muted" };
    default:
      return { label: status, cls: "badge-muted" };
  }
}
