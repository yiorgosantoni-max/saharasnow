import {Resend} from "resend";
import {required} from "./server";

const escapeHtml=(value:unknown)=>String(value??"").replace(/[&<>"']/g,character=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[character]||character));

export async function notifyAdmin(input:{subject:string;heading:string;message:string;details?:Record<string,unknown>;actionLabel?:string;actionPath?:string}){
  try{
    const appUrl=required("APP_URL"),adminEmail=(process.env.SUPER_ADMIN_EMAIL||"yiorgosantoni@gmail.com").trim();
    const rows=Object.entries(input.details||{}).map(([label,value])=>`<tr><td style="padding:9px 12px;border-bottom:1px solid #eee;color:#747184">${escapeHtml(label)}</td><td style="padding:9px 12px;border-bottom:1px solid #eee;font-weight:700">${escapeHtml(value)}</td></tr>`).join("");
    const action=input.actionPath?`<p><a href="${appUrl}${input.actionPath}" style="display:inline-block;background:#075ee8;color:#fff;text-decoration:none;padding:12px 17px;border-radius:8px;font-weight:bold">${escapeHtml(input.actionLabel||"Open admin dashboard")}</a></p>`:"";
    const result=await new Resend(required("RESEND_API_KEY")).emails.send({from:required("EMAIL_FROM"),to:adminEmail,subject:input.subject,html:`<div style="font-family:Arial,sans-serif;color:#17154a;max-width:650px;margin:auto;padding:24px"><header style="display:flex;align-items:center;gap:12px"><img src="${appUrl}/logo.png" alt="SaharaSnow" width="68" height="68" style="object-fit:contain"><h1>SaharaSnow</h1></header><h2>${escapeHtml(input.heading)}</h2><p>${escapeHtml(input.message)}</p>${rows?`<table style="width:100%;border-collapse:collapse;margin:20px 0">${rows}</table>`:""}${action}<p style="font-size:11px;color:#8a8796">Automated marketplace notification</p></div>`});
    if(result.error){console.error("Admin notification rejected",{subject:input.subject,message:result.error.message});return false;}
    return true;
  }catch(error){console.error("Admin notification failed",{subject:input.subject,message:error instanceof Error?error.message:"Unknown error"});return false;}
}
