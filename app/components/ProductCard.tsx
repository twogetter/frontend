import Link from "next/link";
import type { ProductListItem } from "../lib/types";
import { won } from "../lib/format";

export default function ProductCard({ p }: { p: ProductListItem }) {
  return (
    <Link href={`/products/${p.id}`} className="product-card">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="product-thumb"
        src={p.imageUrl}
        alt={p.artistName}
        onError={(e) => {
          (e.target as HTMLImageElement).style.visibility = "hidden";
        }}
      />
      <div className="product-body">
        <div className="product-group">{p.groupName || "ARTIST"}</div>
        <div className="product-name">{p.artistName}</div>
        <div className="product-price">
          {won(p.price)} <small>/ 월</small>
        </div>
      </div>
    </Link>
  );
}
