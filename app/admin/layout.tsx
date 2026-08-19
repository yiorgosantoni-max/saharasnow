import Link from "next/link";

export default function AdminLayout({children}:{children:React.ReactNode}){
  return <>
    <div style={{position:"sticky",top:0,zIndex:1000,display:"flex",justifyContent:"flex-end",alignItems:"center",gap:10,padding:"10px 24px",background:"#17154a",borderBottom:"1px solid rgba(255,255,255,.12)"}}>
      <Link href="/admin" style={{color:"#fff",textDecoration:"none",fontWeight:800,fontSize:13,padding:"9px 14px",borderRadius:8}}>ADMIN DASHBOARD</Link>
      <Link href="/admin/messages" style={{color:"#fff",textDecoration:"none",fontWeight:900,fontSize:13,padding:"9px 16px",borderRadius:8,background:"#d92d20",boxShadow:"0 4px 12px rgba(217,45,32,.28)"}}>💬 MESSAGES</Link>
    </div>
    {children}
  </>;
}
