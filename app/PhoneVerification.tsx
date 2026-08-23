"use client";
import { useRef, useState } from "react";
import { PhoneAuthProvider, RecaptchaVerifier, linkWithCredential, reauthenticateWithCredential } from "firebase/auth";
import { getClientAuth } from "@/lib/firebase-client";

const PHONE_PATTERN = /^\+[1-9]\d{7,14}$/;

export default function PhoneVerification({ phoneVerified, phoneOnFile, onVerified }: { phoneVerified: boolean; phoneOnFile: string; onVerified: (phoneNumber: string) => void }) {
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
    const phone = phoneInput.trim();
    if (!PHONE_PATTERN.test(phone)) { setNotice("Enter your phone number in international format, e.g. +15551234567."); return; }
    setBusy(true);
    try {
      const auth = getClientAuth();
      if (!auth.currentUser) throw new Error("Please sign in again.");
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

  return <div className="listingStep" style={{ margin: 0 }}>
    <div ref={recaptchaContainerRef} />
    {phoneVerified && !codeSent && <p>✓ Verified: <b>{phoneOnFile}</b></p>}
    <label>{phoneVerified ? "Change mobile number" : "Mobile number"} <small>Include your country code, e.g. +1 555 123 4567</small>
      <input value={phoneInput} onChange={e => setPhoneInput(e.target.value)} placeholder="+15551234567" disabled={codeSent} />
    </label>
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
