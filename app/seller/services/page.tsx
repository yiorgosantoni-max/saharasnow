"use client";

import { useEffect, useMemo, useState } from "react";
import { getClientAuth } from "@/lib/firebase-client";

type Listing = {
  id: string;
  title?: string;
  status?: string;
  category?: string;
  subcategory?: string;
  sellerName?: string;
  photoUrls?: string[];
  packages?: Array<{ priceCents: number }>;
  priceCents?: number;
  updatedAt?: unknown;
};

type Stats = { orderCount: number; reviewCount: number; averageRating: number; shareCount: number; favoriteCount: number };

const emptyStats: Stats = { orderCount: 0, reviewCount: 0, averageRating: 0, shareCount: 0, favoriteCount: 0 };

function sellerTier(orderCount: number) {
  if (orderCount >= 501) return { label: "🏆 Top Seller", className: "top" };
  if (orderCount >= 101) return { label: "🔥 Hot Seller", className: "hot" };
  if (orderCount >= 1) return { label: "🌴 New Seller", className: "new" };
  return null;
}

function serviceUrl(item: Listing) {
  const slug = String(item.subcategory || item.category || "service").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "service";
  return `/service/${slug}/${encodeURIComponent(item.id)}`;
}

export default function SellerServicesPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [stats, setStats] = useState<Record<string, Stats>>({});
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const auth = getClientAuth();
      if (!auth.currentUser) {
        setError("Please sign in first.");
        return;
      }
      const token = await auth.currentUser.getIdToken(true);
      const response = await fetch("/api/listings?mine=1", { headers: { authorization: `Bearer ${token}` }, cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load your services");
      const items = (data.listings || []) as Listing[];
      setListings(items);

      const entries = await Promise.all(items.map(async (item) => {
        try {
          const [sellerResponse, engagementResponse] = await Promise.all([
            fetch(`/api/listing-seller-stats?listingId=${encodeURIComponent(item.id)}`, { cache: "no-store" }),
            fetch(`/api/listing-engagement?listingId=${encodeURIComponent(item.id)}`, { cache: "no-store" }),
          ]);
          const seller = await sellerResponse.json();
          const engagement = await engagementResponse.json();
          return [item.id, {
            orderCount: Math.max(0, Number(seller.orderCount) || 0),
            reviewCount: Math.max(0, Number(seller.reviewCount) || 0),
            averageRating: Math.max(0, Number(seller.averageRating) || 0),
            shareCount: Math.max(0, Number(engagement.shareCount) || 0),
            favoriteCount: Math.max(0, Number(engagement.favoriteCount) || 0),
          } satisfies Stats] as const;
        } catch {
          return [item.id, emptyStats] as const;
        }
      }));
      setStats(Object.fromEntries(entries));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load your services");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const visibleCount = useMemo(() => listings.length, [listings.length]);

  return <>
    <style>{`
      .sahara-my-services{max-width:1120px;margin:35px auto;padding:0 20px 70px}
      .sahara-my-services-header{margin-bottom:26px}.sahara-my-services-header small{letter-spacing:2px;font-weight:800;color:#667085}.sahara-my-services-header h1{margin:6px 0;font-size:32px;color:#111827}.sahara-my-services-header p{margin:0;color:#667085}
      .sahara-services-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:18px}
      .sahara-service-card{background:#fff;border:1px solid #e4e7ec;border-radius:12px;overflow:hidden;box-shadow:0 1px 2px rgba(16,24,40,.04);transition:.18s ease}.sahara-service-card:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(16,24,40,.10)}
      .sahara-service-image{height:175px;background:#f2f4f7;overflow:hidden}.sahara-service-image img{width:100%;height:100%;object-fit:cover;display:block}
      .sahara-service-body{padding:14px}.sahara-service-title{margin:0 0 10px;font-size:17px;line-height:1.35;color:#111827}.sahara-service-meta{display:flex;align-items:center;gap:7px;flex-wrap:wrap;font-size:12px;color:#667085}.sahara-service-meta .rating{font-weight:800;color:#111827}.sahara-service-meta .price{margin-left:auto;font-weight:800;color:#111827}
      .sahara-service-tier{display:inline-flex;margin:2px 0 10px;border-radius:5px;padding:5px 8px;font-size:11px;font-weight:800}.sahara-service-tier.new{background:#e7f6e9;color:#166534}.sahara-service-tier.hot{background:#fff0d7;color:#9a3412}.sahara-service-tier.top{background:#fff0cf;color:#855b00}
      .sahara-service-engagement{display:flex;align-items:center;gap:8px;margin-top:12px;padding-top:11px;border-top:1px solid #eef0f2;color:#667085;font-size:11px}.sahara-service-share{margin-left:auto;width:36px;height:36px;border:1px solid #d0d5dd;border-radius:10px;background:#fff;color:#344054;font-size:19px;cursor:pointer}
      .sahara-service-actions{display:flex;gap:8px;margin-top:12px}.sahara-service-edit{flex:1;text-align:center;padding:10px 12px;border-radius:9px;background:#17135f;color:#fff;text-decoration:none;font-weight:700;font-size:13px}.sahara-service-view{padding:10px 12px;border-radius:9px;border:1px solid #d0d5dd;color:#344054;text-decoration:none;font-weight:700;font-size:13px}
      .sahara-empty{background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:24px}.sahara-create{display:inline-block;margin-top:10px;padding:10px 15px;border-radius:10px;background:#17135f;color:#fff;text-decoration:none;font-weight:700}
      @media(max-width:650px){.sahara-services-grid{grid-template-columns:1fr}.sahara-service-image{height:190px}}
    `}</style>
    <main className="sahara-my-services">
      <div className="sahara-my-services-header"><small>SELLER DASHBOARD</small><h1>My services</h1><p>Manage your services and see their real orders, ratings, shares and favourites.</p></div>
      {error && <p role="alert" style={{ padding: 12, borderRadius: 10, background: "#fff1f2", color: "#9f1239" }}>{error}</p>}
      {busy ? <p>Loading your services…</p> : !visibleCount ? <section className="sahara-empty"><h2>No services yet</h2><p>Create your first service from the Seller dashboard.</p><a href="/?services=1" className="sahara-create">Create a service</a></section> : <div className="sahara-services-grid">
        {listings.map((item) => {
          const value = stats[item.id] || emptyStats;
          const tier = sellerTier(value.orderCount);
          const url = serviceUrl(item);
          return <article key={item.id} className="sahara-service-card" data-listing-id={item.id}>
            <div className="sahara-service-image">{item.photoUrls?.[0] ? <img src={item.photoUrls[0]} alt="" /> : null}</div>
            <div className="sahara-service-body">
              {tier && <span className={`sahara-service-tier ${tier.className}`}>{tier.label}</span>}
              <h2 className="sahara-service-title">{item.title || "Untitled service"}</h2>
              <div className="sahara-service-meta">
                <span className="rating">★ {value.averageRating > 0 ? value.averageRating.toFixed(1) : "—"}</span>
                <span>({value.reviewCount})</span>
                <span>•</span>
                <span>{value.orderCount} {value.orderCount === 1 ? "order" : "orders"}</span>
                <span className="price">From ${((Number(item.priceCents || item.packages?.[0]?.priceCents || 0)) / 100).toFixed(2)}</span>
              </div>
              <div className="sahara-service-engagement">
                <span data-sahara-share-count-id={item.id}>{value.shareCount} shares · {value.favoriteCount} favourites</span>
                <button type="button" className="sahara-service-share" data-sahara-share data-listing-id={item.id} data-share-title={item.title || "Check out this service"} data-share-url={url} aria-label="Share this service" title="Share this service">↗</button>
              </div>
              <div className="sahara-service-actions"><a href={url} className="sahara-service-view">View</a><a href={`/seller/edit/${item.id}`} className="sahara-service-edit">Edit listing</a></div>
            </div>
          </article>;
        })}
      </div>}
    </main>
  </>;
}
