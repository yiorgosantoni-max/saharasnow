"use client";
import { useEffect, useRef, useState } from "react";
import { PhoneAuthProvider, RecaptchaVerifier, linkWithCredential, reauthenticateWithCredential } from "firebase/auth";
import { getClientAuth } from "@/lib/firebase-client";

const WITHDRAWAL_FEE_RATE = 0.05;
const MIN_WITHDRAWAL_CENTS = 500;
const PHONE_PATTERN = /^\+[1-9]\d{7,14}$/;
const ADDRESS_PATTERN: Record<"USDT" | "USDC", RegExp> = { USDT: /^T[a-zA-Z0-9]{33}$/, USDC: /^0x[a-fA-F0-9]{40}$/ };
const NETWORK_LABEL: Record<"USDT" | "USDC", string> = { USDT: "Tron (TRC20)", USDC: "BNB Smart Chain (BEP20)" };

type Currency = "USDT" | "USDC";
type SubmitResult = { currency: Currency; grossCents: number; feeCents: number; netCents: number };

const mask = (value: string, tail = 4) => (value.length <= tail ? value : `${value.slice(0, 6)}…${value.slice(-tail)}`);

export default function WithdrawalRequestForm({ onClose, defaultCurrency, onSubmitted }: { onClose: () => void; defaultCurrency: Currency; onSubmitted: (result: SubmitResult) => void }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const [currency, setCurrency] = useState<Currency>(defaultCurrency);
  const [usdtAvailableCents, setUsdtAvailableCents] = useState(0);
  const [usdcAvailableCents, setUsdcAvailableCents] = useState(0);
  const [amount, setAmount] = useState("");

  const [savedAddress, setSavedAddress] = useState<Record<Currency, string>>({ USDT: "", USDC: "" });
  const [addressInput, setAddressInput] = useState("");
  const [confirmNetwork, setConfirmNetwork] = useState(false);
  const [editingAddress, setEditingAddress] = useState(false);

  const [phoneVerified, setPhoneVerified] = useState(false);
  const [phoneOnFile, setPhoneOnFile] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [justVerified, setJustVerified] = useState(false);
  const verificationIdRef = useRef("");
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);
  const recaptchaContainerRef = useRef<HTMLDivElement | null>(null);

  const [confirmAccurate, setConfirmAccurate] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const auth = getClientAuth();
        const token = await auth.currentUser?.getIdToken();
        if (!token) { setNotice("Please sign in again."); setLoading(false); return; }
        const res = await fetch("/api/withdrawals", { headers: { authorization: `Bearer ${token}` } });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Unable to load withdrawal details.");
        setUsdtAvailableCents(Number(data.usdtAvailableCents || 0));
        setUsdcAvailableCents(Number(data.usdcAvailableCents || 0));
        setPhoneVerified(Boolean(data.phoneVerified));
        setPhoneOnFile(String(data.phoneNumber || ""));
        setPhoneInput(String(data.phoneNumber || ""));
        setSavedAddress({ USDT: String(data.usdtWithdrawAddress || ""), USDC: String(data.usdcWithdrawAddress || "") });
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "Unable to load withdrawal details.");
      } finally {
        setLoading(false);
      }
    })();
    return () => { recaptchaRef.current?.clear(); recaptchaRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const availableCents = currency === "USDT" ? usdtAvailableCents : usdcAvailableCents;
  const amountCents = Math.round(Number(amount || 0) * 100);
  const feeCents = Math.round(amountCents * WITHDRAWAL_FEE_RATE);
  const netCents = amountCents - feeCents;
  const validAmount = Number.isFinite(amountCents) && amountCents >= MIN_WITHDRAWAL_CENTS && amountCents <= availableCents;

  const hasAddress = Boolean(savedAddress[currency]) && !editingAddress;

  const continueStep = () => {
    setNotice("");
    if (step === 1) {
      if (availableCents < MIN_WITHDRAWAL_CENTS) { setNotice(`Your available ${currency} balance is below the $5.00 minimum withdrawal.`); return; }
      if (!validAmount) { setNotice(`Enter an amount between $5.00 and $${(availableCents / 100).toFixed(2)}.`); return; }
      setStep(2);
      return;
    }
    if (step === 2) {
      if (!hasAddress) { setNotice(`Save and confirm your ${currency} withdrawal address before continuing.`); return; }
      setStep(3);
      return;
    }
    if (step === 3) {
      if (!justVerified) { setNotice("Verify your phone with the SMS code before continuing."); return; }
      setStep(4);
      return;
    }
  };

  async function saveAddress() {
    setNotice("");
    if (!ADDRESS_PATTERN[currency].test(addressInput.trim())) { setNotice(`Enter a valid ${currency} address for the ${NETWORK_LABEL[currency]} network.`); return; }
    if (!confirmNetwork) { setNotice(`Confirm that this address is a ${NETWORK_LABEL[currency]} address.`); return; }
    setBusy(true);
    try {
      const auth = getClientAuth();
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/profile/withdrawal-address", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify({ currency, address: addressInput.trim(), confirmNetwork: true }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to save address.");
      setSavedAddress(prev => ({ ...prev, [currency]: addressInput.trim() }));
      setEditingAddress(false);
      setAddressInput("");
      setConfirmNetwork(false);
      setNotice("Withdrawal address saved.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to save address.");
    } finally {
      setBusy(false);
    }
  }

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
      setPhoneVerified(true);
      setPhoneOnFile(data.phoneNumber || phoneInput.trim());
      setJustVerified(true);
      setNotice("Phone number verified.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to verify the code. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    setNotice("");
    if (!confirmAccurate) { setNotice("Confirm the details above before submitting."); return; }
    setBusy(true);
    try {
      const auth = getClientAuth();
      if (!auth.currentUser) throw new Error("Please sign in again.");
      const token = await auth.currentUser.getIdToken(true);
      const res = await fetch("/api/withdrawals", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify({ currency, amountCents }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to submit withdrawal request.");
      setSubmitted(true);
      onSubmitted({ currency, grossCents: amountCents, feeCents, netCents });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to submit withdrawal request.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="listingBackdrop"><div className="listingModal" style={{ maxWidth: 420, textAlign: "center", padding: 50 }}>Loading withdrawal details…</div></div>;

  if (submitted) return <div className="listingBackdrop"><div className="listingModal listingSuccess"><button className="listingClose" onClick={onClose}>×</button><span>✓</span><h2>Withdrawal requested</h2><p>Your request for ${(amountCents / 100).toFixed(2)} {currency} (net ${(netCents / 100).toFixed(2)} {currency} after the 5% fee) was submitted to the SaharaSnow administrator for manual payout to {mask(savedAddress[currency])}.</p><button className="primary" onClick={onClose}>Close</button></div></div>;

  return <div className="listingBackdrop" onMouseDown={onClose}>
    <div ref={recaptchaContainerRef} />
    <div className="listingModal" onMouseDown={e => e.stopPropagation()}>
      <button type="button" className="listingClose" onClick={onClose}>×</button>
      <div className="listingHeading"><div><small>SELLER WITHDRAWAL</small><h2>Request a withdrawal</h2></div><b>Step {step} of 4</b></div>
      <div className="listingProgress"><i style={{ width: `${step * 25}%` }} /></div>

      {step === 1 && <div className="listingStep">
        <h3>Amount</h3>
        <label>Currency<select value={currency} onChange={e => { setCurrency(e.target.value as Currency); setAmount(""); }}>
          <option value="USDT" disabled={usdtAvailableCents < MIN_WITHDRAWAL_CENTS}>USDT — ${(usdtAvailableCents / 100).toFixed(2)} available</option>
          <option value="USDC" disabled={usdcAvailableCents < MIN_WITHDRAWAL_CENTS}>USDC — ${(usdcAvailableCents / 100).toFixed(2)} available</option>
        </select></label>
        <label>Amount to withdraw (USD value) <span>Available: ${(availableCents / 100).toFixed(2)}</span>
          <input type="number" min="5" step="0.01" max={(availableCents / 100).toFixed(2)} value={amount} onChange={e => setAmount(e.target.value)} placeholder="Minimum $5.00" />
        </label>
        {amountCents > 0 && <div className="listingPreview" style={{ padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}><span>Amount</span><b>${(amountCents / 100).toFixed(2)} {currency}</b></div>
          <div style={{ display: "flex", justifyContent: "space-between" }}><span>Withdrawal fee (5%)</span><b>-${(feeCents / 100).toFixed(2)} {currency}</b></div>
          <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #e1e2eb", marginTop: 8, paddingTop: 8 }}><span>You receive</span><b>${(netCents / 100).toFixed(2)} {currency}</b></div>
        </div>}
      </div>}

      {step === 2 && <div className="listingStep">
        <h3>Withdrawal address</h3>
        {hasAddress ? <div className="listingPreview" style={{ padding: 16 }}>
          <p>Your saved {currency} address ({NETWORK_LABEL[currency]}):</p>
          <p><b>{mask(savedAddress[currency], 6)}</b></p>
          <button type="button" onClick={() => { setEditingAddress(true); setAddressInput(""); setConfirmNetwork(false); }}>Change address</button>
        </div> : <>
          <label>{currency} withdrawal address <small>{NETWORK_LABEL[currency]} network only</small>
            <input value={addressInput} onChange={e => setAddressInput(e.target.value)} placeholder={currency === "USDT" ? "T..." : "0x..."} />
          </label>
          <label className="listingConfirm"><input type="checkbox" checked={confirmNetwork} onChange={e => setConfirmNetwork(e.target.checked)} /> This is a {NETWORK_LABEL[currency]} address. Funds sent to the wrong network cannot be recovered.</label>
          <div className="listingActions" style={{ marginTop: 12 }}>
            {savedAddress[currency] && <button type="button" onClick={() => { setEditingAddress(false); setAddressInput(""); setConfirmNetwork(false); }}>Cancel</button>}
            <button type="button" className="primary" disabled={busy} onClick={saveAddress}>{busy ? "Saving…" : "Save address"}</button>
          </div>
        </>}
      </div>}

      {step === 3 && <div className="listingStep">
        <h3>Verify your phone</h3>
        <p>For security, every withdrawal requires a fresh SMS verification code.</p>
        {!phoneVerified && <label>Phone number <small>Include your country code, e.g. +1 555 123 4567</small>
          <input value={phoneInput} onChange={e => setPhoneInput(e.target.value)} placeholder="+15551234567" disabled={codeSent} />
        </label>}
        {phoneVerified && <p><b>{mask(phoneOnFile, 4)}</b></p>}
        {!codeSent ? <button type="button" className="primary" disabled={busy} onClick={sendCode}>{busy ? "Sending…" : "Send SMS code"}</button> : <>
          <label>6-digit code<input value={code} onChange={e => setCode(e.target.value)} maxLength={6} placeholder="123456" /></label>
          <div className="listingActions" style={{ marginTop: 0 }}>
            <button type="button" onClick={() => { setCodeSent(false); setCode(""); }}>Resend code</button>
            <button type="button" className="primary" disabled={busy || justVerified} onClick={verifyCode}>{busy ? "Verifying…" : justVerified ? "Verified ✓" : "Verify code"}</button>
          </div>
        </>}
      </div>}

      {step === 4 && <div className="listingStep">
        <h3>Confirm and submit</h3>
        <article className="listingPreview" style={{ padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}><span>Amount</span><b>${(amountCents / 100).toFixed(2)} {currency}</b></div>
          <div style={{ display: "flex", justifyContent: "space-between" }}><span>Withdrawal fee (5%)</span><b>-${(feeCents / 100).toFixed(2)} {currency}</b></div>
          <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #e1e2eb", marginTop: 8, paddingTop: 8 }}><span>You receive</span><b>${(netCents / 100).toFixed(2)} {currency}</b></div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}><span>Payout address</span><b>{mask(savedAddress[currency], 6)} ({NETWORK_LABEL[currency]})</b></div>
          <div style={{ display: "flex", justifyContent: "space-between" }}><span>Phone</span><b>{mask(phoneOnFile, 4)}</b></div>
        </article>
        <p>Your request will be sent to the SaharaSnow administrator for manual payout.</p>
        <label className="listingConfirm"><input type="checkbox" checked={confirmAccurate} onChange={e => setConfirmAccurate(e.target.checked)} /> I confirm these withdrawal details are correct.</label>
      </div>}

      {notice && <p className="listingNotice" role="alert">{notice}</p>}
      <div className="listingActions">
        {step > 1 && <button type="button" onClick={() => { setNotice(""); setStep(step - 1); }}>Back</button>}
        {step < 4 ? <button type="button" className="primary" onClick={continueStep}>Continue</button> : <button type="button" className="primary" disabled={busy} onClick={submit}>{busy ? "Submitting…" : "Submit withdrawal request"}</button>}
      </div>
    </div>
  </div>;
}
