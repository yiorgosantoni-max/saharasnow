import type {Metadata} from "next";
import Link from "next/link";
import {notFound} from "next/navigation";
import {db} from "@/lib/firebase-admin";
import styles from "./seller.module.css";

type Params={slug:string;id:string};
type PublicSeller={id:string;name:string;country:string;image:string;joinedAt:Date|null;kycVerified:boolean;services:Array<Record<string,unknown>>};

const slugify=(value:string)=>value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
const asDate=(value:unknown)=>value&&typeof value==="object"&&"toDate" in value&&typeof (value as {toDate?:unknown}).toDate==="function"?(value as {toDate:()=>Date}).toDate():value instanceof Date?value:null;

async function getSeller(id:string):Promise<PublicSeller|null>{
  const profileSnap=await db.collection("users").doc(id).get();
  if(!profileSnap.exists)return null;
  const profile=profileSnap.data()||{};
  const name=[profile.firstName,profile.lastName].map(value=>String(value||"").trim()).filter(Boolean).join(" "),country=String(profile.country||"").trim();
  if(!name||!country)return null;
  const listingSnap=await db.collection("listings").where("sellerId","==",id).limit(100).get();
  const services=listingSnap.docs.filter(doc=>doc.data().status==="active").map(doc=>({id:doc.id,...doc.data()}));
  return {id,name,country,image:String(profile.profileImageUrl||""),joinedAt:asDate(profile.joinedAt),kycVerified:profile.kycStatus==="approved",services};
}

export async function generateMetadata({params}:{params:Promise<Params>}):Promise<Metadata>{
  const {id}=await params;const seller=await getSeller(id);
  return seller?{title:`${seller.name} | SaharaSnow seller`,description:`View ${seller.name}'s services on SaharaSnow.`}:{title:"Seller not found | SaharaSnow"};
}

export default async function SellerPage({params}:{params:Promise<Params>}){
  const {id}=await params;const seller=await getSeller(id);if(!seller)notFound();
  return <main className={styles.page}>
    <header className={styles.header}><Link href="/" className={styles.brand}><img src="/logo.png" alt="SaharaSnow"/><span>SaharaSnow</span></Link><Link href="/#explore">← Browse services</Link></header>
    <section className={styles.profile}>
      {seller.image?<img className={styles.avatar} src={seller.image} alt={seller.name}/>:<div className={styles.avatarFallback}>{seller.name[0]}</div>}
      <div><p className={styles.eyebrow}>SELLER PROFILE</p><h1>{seller.name}</h1><p className={styles.meta}>{seller.country||"Country not provided"}{seller.joinedAt?` · Joined ${seller.joinedAt.toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"})}`:""}</p>{seller.kycVerified&&<span className={styles.verified}>✓ KYC verified</span>}</div>
    </section>
    <section className={styles.services}><h2>Services by {seller.name}</h2>{seller.services.length?<div className={styles.grid}>{seller.services.map(service=>{const title=String(service.title||"Service");const subcategory=String(service.subcategory||service.category||"service");const image=Array.isArray(service.photoUrls)&&service.photoUrls[0]?String(service.photoUrls[0]):"";return <Link className={styles.card} key={String(service.id)} href={`/service/${slugify(`${subcategory}-by-${seller.name}`)}/${service.id}`}><div className={styles.image}>{image?<img src={image} alt={title}/>:<span>Service image</span>}</div><div className={styles.body}><small>{subcategory}</small><h3>{title}</h3><strong>From €{(Number(service.priceCents||0)/100).toFixed(2)}</strong></div></Link>})}</div>:<div className={styles.empty}>This seller has no published services yet.</div>}</section>
  </main>;
}
