"use client";
import { useRef, useState } from "react";
import { PhoneAuthProvider, RecaptchaVerifier, linkWithCredential, reauthenticateWithCredential } from "firebase/auth";
import { getClientAuth } from "@/lib/firebase-client";

const PHONE_PATTERN = /^\+[1-9]\d{7,14}$/;

export default function PhoneVerification({ phoneVerified, phoneOnFile, onVerified, allowSetNumber = true, kycApproved = true }: { phoneVerified: boolean; phoneOnFile: string; onVerified: (phoneNumber: string) => void; allowSetNumber?: boolean; kycApproved?: boolean }) {
  const [phoneInput, setPhoneInput] = useState(phoneOnFile);
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const verificationIdRef = useRef("");
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);
  const recaptchaContainerRef = useRef<HTMLDivElement | null>(null);

  async function sendCode() {
    setNotice("");
    const phone = (allowSetNumber ? phoneInput : phoneOnFile).trim();
    if (!PHONE_PATTERN.test(phone)) { setNotice("Enter your phone number in international format, e.g. +15551234567."); return; }
    setBusy(true);
    try {
      const auth = getClientAuth();
      if (!auth.currentUser) throw new Error("Please sign in again.");
      // Ask the server whether this account may set up SMS at all. Firebase
      // sends the SMS straight from the browser and cannot see KYC status, so
      // this check has to happen before verifyPhoneNumber or a non-verified
      // account could still consume SMS quota.
      const gateToken = await auth.currentUser.getIdToken();
      const gateRes = await fetch("/api/profile/phone", { headers: { authorization: `Bearer ${gateToken}` }, cache: "no-store" });
      const gate = await gateRes.json();
      if (!gateRes.ok) throw new Error(gate.error || "Unable to check verification eligibility.");
      if (!gate.kycApproved) throw new Error(gate.reason || "Complete KYC identity verification before setting up SMS one-time codes.");
      if (!recaptchaRef.current && recaptchaContainerRef.current) {
        recaptchaRef.current = new RecaptchaVerifier(auth, recaptchaContainerRef.current, { size: "invisible" });
      }
      if (!recaptchaRef.current) throw new Error("Unable to prepare verification. Please try again.");
      const provider = new PhoneAuthProvider(auth);
      verificationIdRef.current = await provider.verifyPhoneNumber(phone, recaptchaRef.current);
      setCodeSent(true);
      setNotice(`Code sent to ${phone}.`);
    } catch (error) {
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
      setNotice(error instanceof Error ? error.message : "Unable to send verification code.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode() {
    setNotice("");
    if (!/^\d{6}$/.test(code.trim())) { setNotice("Enter the 6-digit code."); return; }
    setBusy(true);
    try {
      const auth = getClientAuth();
      if (!auth.currentUser) throw new Error("Please sign in again.");
      const credential = PhoneAuthProvider.credential(verificationIdRef.current, code.trim());
      if (phoneVerified && phoneOnFile === phoneInput.trim()) {
        await reauthenticateWithCredential(auth.currentUser, credential);
      } else {
        try {
          await linkWithCredential(auth.currentUser, credential);
        } catch (linkError) {
          if (linkError instanceof Error && linkError.message.includes("auth/provider-already-linked")) {
            await reauthenticateWithCredential(auth.currentUser, credential);
          } else {
            throw linkError;
          }
        }
      }
      const token = await auth.currentUser.getIdToken(true);
      const res = await fetch("/api/profile/phone", { method: "POST", headers: { authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to confirm phone verification.");
      setCodeSent(false);
      setCode("");
      setNotice("Phone number verified.");
      onVerified(data.phoneNumber || phoneInput.trim());
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to verify the code. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!phoneVerified && !kycApproved) {
    return <div className="listingStep" style={{ margin: 0 }}>
      <p className="listingNotice" role="alert">Complete KYC identity verification first. Once an administrator approves your documents, you'll be able to set up SMS one-time codes here.</p>
    </div>;
  }

  if (!allowSetNumber && !phoneVerified) {
    return <div className="listingStep" style={{ margin: 0 }}>
      <p className="listingNotice" role="alert">You haven't verified a mobile number yet. Add and verify one from your account's Profile tab first, then come back here.</p>
    </div>;
  }

  if (allowSetNumber && phoneVerified) {
    const subject = encodeURIComponent("Mobile number change request");
    const body = encodeURIComponent(`Please change my verified mobile number on SaharaSnow.\n\nFull name:\nAccount email:\nCurrent bound number: ${phoneOnFile}\nNew number requested:\nReason for change:\n\nI understand I may be asked to confirm my identity with a KYC document matching my profile before this change is made.`);
    return <div className="listingStep" style={{ margin: 0 }}>
      <p>✓ Verified: <b>{phoneOnFile}</b></p>
      <p className="listingNotice">To protect withdrawals, a verified mobile number can't be changed from your profile. Email the administrator with your full name, account email, current number, new number and reason for the change — a KYC document matching your profile may be required before it's updated.</p>
      <a className="primary" style={{ display: "inline-block", textDecoration: "none", textAlign: "center" }} href={`mailto:info@saharasnow.com?subject=${subject}&body=${body}`}>Request number change</a>
    </div>;
  }

  return <div className="listingStep" style={{ margin: 0 }}>
    <div ref={recaptchaContainerRef} />
    {phoneVerified && !codeSent && <p>✓ Verified: <b>{phoneOnFile}</b></p>}
    {allowSetNumber && <label>{phoneVerified ? "Change mobile number" : "Mobile number"} <small>Include your country code, e.g. +1 555 123 4567</small>
      <input value={phoneInput} onChange={e => setPhoneInput(e.target.value)} placeholder="+15551234567" disabled={codeSent} />
    </label>}
    {!codeSent ? <div className="listingActions" style={{ marginTop: 0, justifyContent: "flex-start" }}>
      <button type="button" className="primary" disabled={busy} onClick={sendCode}>{busy ? "Sending…" : "Send SMS code"}</button>
    </div> : <>
      <label>6-digit code<input value={code} onChange={e => setCode(e.target.value)} maxLength={6} placeholder="123456" /></label>
      <div className="listingActions" style={{ marginTop: 0, justifyContent: "flex-start" }}>
        <button type="button" onClick={() => { setCodeSent(false); setCode(""); setNotice(""); }}>Cancel</button>
        <button type="button" className="primary" disabled={busy} onClick={verifyCode}>{busy ? "Verifying…" : "Verify code"}</button>
      </div>
    </>}
    {notice && <p className="listingNotice" role="alert">{notice}</p>}
  </div>;
}
