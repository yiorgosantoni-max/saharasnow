"use client";
import { FormEvent, useState } from "react";

export default function ContactAdmin(){
  const [form,setForm]=useState({name:"",email:"",subject:"",message:"",website:""});
  const [status,setStatus]=useState<"idle"|"sending"|"sent"|"error">("idle");
  const [notice,setNotice]=useState("");
  async function submit(event:FormEvent){
    event.preventDefault();setStatus("sending");setNotice("");
    try{
      const response=await fetch("/api/contact",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(form)});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||"Unable to send message");
      setStatus("sent");setNotice(`Message sent. Your reference is ${data.reference}.`);setForm({name:"",email:"",subject:"",message:"",website:""});
    }catch(error){setStatus("error");setNotice(error instanceof Error?error.message:"Unable to send contact message");}
  }
  return <section className="contactAdmin" id="contact-admin"><div className="contactIntro"><p className="eyebrow coral">Contact the administrator</p><h2>How can we help?</h2><p>Send a secure support request to the SaharaSnow administrator. Include an order number when your question concerns a purchase.</p><div className="adminAddress"><span>✉</span><div><small>ADMIN EMAIL</small><b>info@saharasnow.com</b></div></div></div><form onSubmit={submit}><div className="contactRow"><label>Your name<input required minLength={2} maxLength={80} value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label><label>Your email<input required type="email" maxLength={254} value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label></div><label>Subject<input required minLength={3} maxLength={120} placeholder="Order, payment, KYC or account help" value={form.subject} onChange={e=>setForm({...form,subject:e.target.value})}/></label><label>Message<textarea required minLength={20} maxLength={5000} rows={7} placeholder="Explain how the administrator can help…" value={form.message} onChange={e=>setForm({...form,message:e.target.value})}/></label><label className="contactTrap" aria-hidden="true">Website<input tabIndex={-1} autoComplete="off" value={form.website} onChange={e=>setForm({...form,website:e.target.value})}/></label><button className="primary" disabled={status==="sending"}>{status==="sending"?"Sending…":"Email administrator"}</button>{notice&&<p className={`contactNotice ${status}`} role="status">{notice}</p>}<small className="contactPrivacy">Your request is stored securely for support and audit purposes.</small></form></section>
}
