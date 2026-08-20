import {NextRequest,NextResponse} from "next/server";
import {db} from "@/lib/firebase-admin";
import {publicError,userFromRequest} from "@/lib/server";

export async function POST(req:NextRequest){try{
 const user=await userFromRequest(req);
 const {listingId,purpose}=await req.json();
 if(purpose!=="listing-credits")return NextResponse.json({error:"Stripe is not used for marketplace payments."},{status:410});
 const id=String(listingId||"");
 const ref=db.collection("listings").doc(id),snap=await ref.get();
 if(!snap.exists)return NextResponse.json({error:"Listing not found"},{status:404});
 const listing=snap.data()||{};
 if(String(listing.sellerId)!==user.uid)return NextResponse.json({error:"You can only pay for your own listing"},{status:403});
 if(String(listing.status)!=="awaiting-listing-fee")return NextResponse.json({error:"This listing does not require a listing-credit payment"},{status:400});
 return NextResponse.json({url:`/listing-credits?listing=${encodeURIComponent(id)}`,currency:"USDT/USDC",amount:2,credits:5});
}catch(e){const x=publicError(e);return NextResponse.json({error:x.message},{status:x.status});}}
