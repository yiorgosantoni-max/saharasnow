import {randomUUID} from "node:crypto";
import {NextRequest,NextResponse} from "next/server";
import {adminStorage} from "@/lib/firebase-admin";
import {publicError,userFromRequest} from "@/lib/server";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function POST(req:NextRequest){
  try{
    const user=await userFromRequest(req),form=await req.formData(),upload=form.get("file"),kind=String(form.get("kind")||"");
    if(!(upload instanceof File))return NextResponse.json({error:"Choose an identity image to upload."},{status:400});
    if(!["identity","selfie"].includes(kind))return NextResponse.json({error:"Invalid KYC upload type."},{status:400});
    if(!["image/png","image/jpeg","image/jpg"].includes(upload.type.toLowerCase()))return NextResponse.json({error:"KYC documents must be a PNG, JPG or JPEG image."},{status:400});
    if(upload.size<=0||upload.size>10*1024*1024)return NextResponse.json({error:"Each KYC image must be smaller than 10 MB."},{status:400});
    const extension=(upload.name.split(".").pop()||"jpg").replace(/[^a-z0-9]/gi,"").toLowerCase().slice(0,8)||"jpg",path=`kyc/${user.uid}/${Date.now()}-${kind}-${randomUUID()}.${extension}`,downloadToken=randomUUID(),bucket=adminStorage.bucket(process.env.FIREBASE_STORAGE_BUCKET?.trim()||process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim()||`${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.firebasestorage.app`),file=bucket.file(path);
    await file.save(Buffer.from(await upload.arrayBuffer()),{resumable:false,contentType:upload.type,metadata:{cacheControl:"private,no-store,max-age=0",metadata:{firebaseStorageDownloadTokens:downloadToken,ownerUid:user.uid,kycKind:kind}}});
    const url=`https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${downloadToken}`;
    return NextResponse.json({url,path});
  }catch(error){const result=publicError(error),message=result.message.includes("storage.objects")?"The website server does not yet have permission to save KYC files in Firebase Storage.":result.message;console.error("KYC upload failed",{message:result.message});return NextResponse.json({error:message},{status:result.status===401?401:500});}
}
