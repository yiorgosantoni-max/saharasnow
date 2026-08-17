import EditSellerListingForm from "@/app/EditSellerListingForm";

export default async function EditSellerListingPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 return <EditSellerListingForm id={id}/>;
}
