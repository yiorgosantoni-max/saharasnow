# Crypto payment notification flow

When a USDT or USDC transaction hash is submitted for a service order:

- Buyer receives an in-site notification that payment is awaiting administrator approval.
- Seller receives an in-site notification that the buyer submitted crypto payment and the order is awaiting approval.
- Buyer receives an email confirming the submitted payment is awaiting approval.
- Seller receives an email informing them the order payment is awaiting approval.
- Administrator receives the existing crypto-payment email and sees the payment in the CRYPTO queue.

When an administrator approves the payment:

- Buyer receives an in-site notification and email that payment was approved.
- Seller receives an in-site notification and email that payment was approved and the order is active.

When an administrator rejects the payment:

- Buyer receives an in-site notification and email that payment was rejected.
- Seller receives an in-site notification and email that payment was rejected and the order remains unpaid.

All events should use the existing notification and email helpers and be triggered server-side with the buyer and seller IDs/email addresses stored on the order/payment record.
