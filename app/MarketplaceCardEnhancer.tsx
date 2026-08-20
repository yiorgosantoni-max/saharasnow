"use client";

import { useEffect } from "react";

type SellerStats = {
  orderCount: number;
  reviewCount: number;
  averageRating: number;
};

type Engagement = {
  shareCount: number;
  favoriteCount: number;
};

const engagementCache = new Map<string, Engagement>();

function sellerBadge(orderCount: number) {
  if (orderCount >= 501) return ["🏆 Top Seller", "top"] as const;
  if (orderCount >= 101) return ["🔥 Hot Seller", "hot"] as const;
  if (orderCount >= 1) return ["🌴 New Seller", "new"] as const;
  return null;
}

function formatPrice(text: string) {
  const match = text.match(/[€$]?\s*([\d.,]+)/);
  return match?.[1] ? `From $${match[1]}` : "From $—";
}

function paintEngagement(listingId: string, value: Engagement) {
  engagementCache.set(listingId, value);
  document
    .querySelectorAll<HTMLElement>(`[data-sahara-engagement-id="${CSS.escape(listingId)}"]`)
    .forEach((element) => {
      element.textContent = `${value.shareCount} shares · ${value.favoriteCount} favourites`;
    });
}

async function loadEngagement(listingId: string) {
  try {
    const response = await fetch(`/api/listing-engagement?listingId=${encodeURIComponent(listingId)}`, {
      cache: "no-store",
    });
    if (!response.ok) return;
    const data = await response.json();
    paintEngagement(listingId, {
      shareCount: Math.max(0, Number(data.shareCount) || 0),
      favoriteCount: Math.max(0, Number(data.favoriteCount) || 0),
    });
  } catch {
    // Keep the UI at zero until the real count can be loaded.
  }
}

async function loadStats(listingId: string) {
  try {
    const response = await fetch(`/api/listing-seller-stats?listingId=${encodeURIComponent(listingId)}`, {
      cache: "no-store",
    });
    if (!response.ok) return null;
    const data = await response.json();
    return {
      orderCount: Math.max(0, Number(data.orderCount) || 0),
      reviewCount: Math.max(0, Number(data.reviewCount) || 0),
      averageRating: Math.max(0, Number(data.averageRating) || 0),
    } satisfies SellerStats;
  } catch {
    return null;
  }
}

function enhanceCard(article: HTMLElement) {
  if (article.dataset.saharaCardEnhanced === "1") return;

  const listingId = article.id.replace(/^service-/i, "").trim();
  if (!listingId) return;

  const cardBody = article.querySelector<HTMLElement>(".cardBody");
  const sellerLink = article.querySelector<HTMLElement>(".sellerLink,.seller");
  const title = cardBody?.querySelector<HTMLElement>("h3");
  if (!cardBody || !sellerLink || !title) return;

  article.dataset.saharaCardEnhanced = "1";
  article.classList.add("saharaMarketplaceCard");
  article.dataset.listingId = listingId;

  article.querySelectorAll<HTMLElement>(".visual .cardShare,.visual .shareToggle").forEach((button) => {
    button.style.display = "none";
  });

  const oldMeta = cardBody.querySelector<HTMLElement>(".meta");
  const priceText =
    oldMeta?.querySelector("span:last-child")?.textContent?.trim() ||
    oldMeta?.textContent?.trim() ||
    "";

  const ratingRow = document.createElement("div");
  ratingRow.className = "saharaRatingRow";
  ratingRow.innerHTML =
    `<span class="saharaRatingValue">★ <b>—</b></span>` +
    `<span class="saharaReviewCount">(0)</span>` +
    `<span class="saharaOrders">0 orders</span>` +
    `<span class="saharaPrice">${formatPrice(priceText)}</span>`;

  if (oldMeta) oldMeta.replaceWith(ratingRow);
  else title.insertAdjacentElement("afterend", ratingRow);

  const actions = document.createElement("div");
  actions.className = "saharaCardBottomActions";
  actions.innerHTML =
    `<span class="saharaEngagementCount" data-sahara-engagement-id="${listingId}">0 shares · 0 favourites</span>` +
    `<button type="button" class="saharaCardShareButton" data-listing-id="${listingId}" aria-label="Share this service" title="Share this service">↗</button>`;
  ratingRow.insertAdjacentElement("afterend", actions);

  const sellerInfo = sellerLink.querySelector<HTMLElement>("div");
  const badge = document.createElement("span");
  badge.className = "saharaSellerBadge";
  if (sellerInfo) sellerInfo.appendChild(badge);

  void Promise.all([loadStats(listingId), loadEngagement(listingId)]).then(([stats]) => {
    if (!stats) return;

    const rating = ratingRow.querySelector<HTMLElement>(".saharaRatingValue b");
    const reviews = ratingRow.querySelector<HTMLElement>(".saharaReviewCount");
    const orders = ratingRow.querySelector<HTMLElement>(".saharaOrders");

    if (rating) rating.textContent = stats.averageRating > 0 ? stats.averageRating.toFixed(1) : "—";
    if (reviews) reviews.textContent = `(${stats.reviewCount})`;
    if (orders) orders.textContent = `${stats.orderCount} ${stats.orderCount === 1 ? "order" : "orders"}`;

    const badgeData = sellerBadge(stats.orderCount);
    if (badgeData) {
      badge.textContent = badgeData[0];
      badge.className = `saharaSellerBadge ${badgeData[1]}`;
    } else {
      badge.remove();
    }
  });
}

export default function MarketplaceCardEnhancer() {
  useEffect(() => {
    const style = document.createElement("style");
    style.dataset.saharaMarketplaceCards = "true";
    style.textContent = `
      #service-results{align-items:start}
      #service-results article.saharaMarketplaceCard{width:264px;min-width:264px;background:#fff;border:1px solid #e3e3e3;border-radius:8px;overflow:hidden;box-shadow:none;transition:transform .18s ease,box-shadow .18s ease}
      #service-results article.saharaMarketplaceCard:hover{transform:translateY(-2px);box-shadow:0 5px 16px rgba(16,24,40,.12)}
      #service-results article.saharaMarketplaceCard .visual{height:160px!important;min-height:160px!important;border-radius:8px 8px 0 0;overflow:hidden;position:relative;background:#eef0f3!important}
      #service-results article.saharaMarketplaceCard .visual>img{width:100%!important;height:100%!important;object-fit:cover!important;display:block}
      #service-results article.saharaMarketplaceCard .visual .cardShare,#service-results article.saharaMarketplaceCard .visual .shareToggle{display:none!important}
      #service-results article.saharaMarketplaceCard .cardBody{padding:9px 10px 11px!important;background:#fff}
      #service-results article.saharaMarketplaceCard .sellerLink,#service-results article.saharaMarketplaceCard .seller{display:flex!important;align-items:center!important;gap:7px!important;min-height:32px;text-decoration:none}
      #service-results article.saharaMarketplaceCard .sellerLink>img,#service-results article.saharaMarketplaceCard .seller>img{width:25px!important;height:25px!important;border-radius:50%!important;flex:0 0 25px}
      #service-results article.saharaMarketplaceCard .sellerLink>div,#service-results article.saharaMarketplaceCard .seller>div{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;align-items:center!important;column-gap:7px!important;width:100%!important;min-width:0}
      #service-results article.saharaMarketplaceCard .sellerLink b,#service-results article.saharaMarketplaceCard .seller b{font-size:13px!important;line-height:1.1!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;color:#111827!important}
      #service-results article.saharaMarketplaceCard .sellerLink small,#service-results article.saharaMarketplaceCard .seller small{grid-column:1/-1!important;font-size:10px!important;color:#6b7280!important;line-height:1.15!important}
      #service-results article.saharaMarketplaceCard h3{font-size:15px!important;line-height:1.3!important;font-weight:500!important;color:#111827!important;margin:7px 0 8px!important;display:-webkit-box!important;-webkit-line-clamp:2!important;-webkit-box-orient:vertical!important;overflow:hidden!important;min-height:39px!important}
      #service-results article.saharaMarketplaceCard .saharaRatingRow{display:flex;align-items:center;gap:5px;font-size:12px;line-height:18px;color:#111827;white-space:nowrap}
      #service-results article.saharaMarketplaceCard .saharaRatingValue{font-weight:700}.saharaReviewCount,.saharaOrders{color:#667085}.saharaPrice{margin-left:auto;font-weight:700;color:#111827}
      #service-results article.saharaMarketplaceCard .saharaCardBottomActions{display:flex!important;align-items:center!important;gap:8px!important;margin-top:7px!important;padding-top:8px!important;border-top:1px solid #eef0f2!important;min-height:38px!important}
      #service-results article.saharaMarketplaceCard .saharaEngagementCount{font-size:11px!important;color:#667085!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis}
      #service-results article.saharaMarketplaceCard .saharaCardShareButton{margin-left:auto!important;width:34px!important;height:34px!important;border:1px solid #d0d5dd!important;border-radius:10px!important;background:#fff!important;color:#344054!important;font-size:19px!important;display:grid!important;place-items:center!important;cursor:pointer!important;z-index:10!important;flex:0 0 34px!important}
      #service-results article.saharaMarketplaceCard .saharaSellerBadge{justify-self:end;align-self:start;white-space:nowrap;border-radius:4px;padding:4px 6px;font-size:10px!important;font-weight:800!important;line-height:1!important;background:#f3f4f6;color:#111827}
      #service-results article.saharaMarketplaceCard .saharaSellerBadge.new{background:#e7f6e9;color:#166534}
      #service-results article.saharaMarketplaceCard .saharaSellerBadge.hot{background:#fff0d7;color:#9a3412}
      #service-results article.saharaMarketplaceCard .saharaSellerBadge.top{background:#fff0cf;color:#855b00}
      @media(max-width:620px){#service-results article.saharaMarketplaceCard{width:244px;min-width:244px}#service-results article.saharaMarketplaceCard .visual{height:148px!important;min-height:148px!important}.saharaOrders{display:none}}
    `;
    document.head.appendChild(style);

    const scan = () => {
      document
        .querySelectorAll<HTMLElement>("#service-results article[id^='service-']")
        .forEach(enhanceCard);
    };

    const refreshEngagement = (event: Event) => {
      const detail = event as CustomEvent<Partial<Engagement> & { listingId?: string }>;
      const listingId = String(detail.detail?.listingId || "");
      if (!listingId) return;
      const previous = engagementCache.get(listingId) || { shareCount: 0, favoriteCount: 0 };
      paintEngagement(listingId, {
        shareCount: Math.max(0, Number(detail.detail?.shareCount ?? previous.shareCount) || 0),
        favoriteCount: Math.max(0, Number(detail.detail?.favoriteCount ?? previous.favoriteCount) || 0),
      });
    };

    document.addEventListener("sahara-share-recorded", refreshEngagement as EventListener);
    scan();

    const root = document.getElementById("service-results");
    const observer = root ? new MutationObserver(scan) : null;
    if (observer && root) {
      observer.observe(root, { childList: true, subtree: true });
    }

    return () => {
      observer?.disconnect();
      document.removeEventListener("sahara-share-recorded", refreshEngagement as EventListener);
      style.remove();
    };
  }, []);

  return null;
}
