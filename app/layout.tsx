import type {Metadata} from "next";import "./globals.css";import "./auth.css";import "./design-menu.css";import "./account.css";import "./discounts.css";import "./kyc.css";import "./live.css";import "./operations.css";import "./presence.css";import "./profile.css";import "./share.css";import "./suite.css";import "./contact.css";import "./listing.css";import "./logout.css";import "./package-toggle.css";import "./favourites.css";import "./trusted-bar.css";import "./bird-motion.css";import CurrencyNormalizer from "./CurrencyNormalizer";
export const metadata:Metadata={title:"Saharasnow Marketplace",description:"Find trusted independent talent for every idea.",other:{"codex-preview":"development"}};
/** Keep the root layout passive. Global DOM MutationObservers that rewrite or
 * inject controls can repeatedly process the homepage while React is rendering,
 * making the page appear frozen. Homepage interactions are handled by their own
 * React components instead of document-wide observers/listeners.
 */
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><CurrencyNormalizer/>{children}</body></html>}
