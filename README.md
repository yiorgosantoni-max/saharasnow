# SaharaSnow Marketplace

Firebase App Hosting-ready Next.js marketplace source. The repository contains no live API keys.

## Included

- SaharaSnow responsive marketplace interface and full category menus
- Passwordless six-digit email codes through Resend (new code on every login)
- Firebase Authentication custom-token sign-in and Firestore data model
- Seller listings: first two free, then €1 buys five annual listing credits through Stripe; maximum two photos and one video
- Functional four-step seller listing form with full gig descriptions, category/subcategory, tags, buyer requirements, Basic/Standard/Premium packages, media preview and admin-review submission
- Real Firebase email-code client sign-in used by authenticated listing uploads and submissions
- Stripe Checkout with a 4% buyer fee and signed webhook processing
- Sequential order/invoice numbers beginning at 1 and emailed invoice summaries
- Five-day dispute deadline stored on paid orders
- Purchase-or-approved-KYC messaging enforcement on the server
- Private KYC storage path and admin-only KYC rules
- Seller balance and manual full withdrawal requests with 10% fee and Google Authenticator verification
- Admin and seller withdrawal email notifications
- Firestore and Storage security rules

## Windows setup from `C:\saharasnow`

1. Install Node.js 20+, Git and Firebase CLI.
2. Copy this project into `C:\saharasnow`.
3. Open PowerShell in that folder and run:

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

4. Fill only local development values in `.env.local`. Never commit that file.
5. Test at `http://localhost:3000`.

## Firebase deployment

```powershell
firebase login
firebase use saharasnow-d518f
firebase deploy --only firestore:rules,firestore:indexes,storage
```

Connect the GitHub repository to **Firebase project `saharasnow-d518f` > App Hosting**. App Hosting will build the `main` branch. The included `.firebaserc` locks Firebase CLI commands to `saharasnow-d518f`.

### Which URL serves the full marketplace?

The full Next.js marketplace must be deployed with **Firebase App Hosting** because Stripe webhooks, login-code email, orders and withdrawals use server routes. Its configured App Hosting address is:

`https://saharasnow--saharasnow-d518f.europe-west4.hosted.app/`

The backend name must be `saharasnow`, the Firebase project must be `saharasnow-d518f`, and the App Hosting region must be `europe-west4`. Connect `saharasnow.com` to this same backend when the custom domain is ready.

`https://saharasnow-d518f.web.app` belongs to classic Firebase Hosting. Do not upload only a static export there, because the server routes would stop working.

Create these App Hosting secrets:

```powershell
firebase apphosting:secrets:set RESEND_API_KEY --project saharasnow-d518f
firebase apphosting:secrets:set OTP_HASH_SECRET --project saharasnow-d518f
firebase apphosting:secrets:set STRIPE_SECRET_KEY --project saharasnow-d518f
firebase apphosting:secrets:set STRIPE_WEBHOOK_SECRET --project saharasnow-d518f
```

Add the public Stripe publishable key and Firebase web configuration as ordinary environment variables. Never prefix a secret key with `NEXT_PUBLIC_`.

## Stripe setup when your account is ready

1. Start in Stripe test mode.
2. Set `STRIPE_SECRET_KEY` to the test secret key.
3. Set `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` to the test publishable key.
4. Create a webhook endpoint at `https://saharasnow--saharasnow-d518f.europe-west4.hosted.app/api/stripe/webhook` (change it to `https://saharasnow.com/api/stripe/webhook` after the custom domain is live).
5. Subscribe it to `checkout.session.completed`.
6. Store the signing secret as `STRIPE_WEBHOOK_SECRET`.
7. Make a low-value test order and verify the order, invoice email and webhook logs before switching to live keys.

## Important launch checks

- Create the Firestore database and Firebase Storage bucket.
- Enable Firebase Authentication.
- Set the administrator custom claim for `info@saharasnow.com`; email equality in rules is an initial safety check, but a custom `admin: true` claim is recommended before adding staff.
- Configure Backblaze B2 only if you still want it instead of Firebase Storage. The included upload rules target Firebase Storage.
- Add a scheduled daily job to release seller funds after `disputeDeadline` when no dispute exists.
- Have a qualified professional review KYC retention, marketplace terms, VAT and payout procedures before production.

## GitHub

```powershell
git init
git add .
git commit -m "Initial SaharaSnow marketplace"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/saharasnow.git
git push -u origin main
```

## Marketplace notifications, earnings and moderation

- Buyer and seller in-app notifications cover KYC, listings, orders, messages, disputes, withdrawals and other account events; important events can also email the user.
- Seller earnings are based on the actual service amount (`sellerNetCents`), while the 4% buyer fee is recorded separately as the platform fee. A €30 order gives the seller €30, not €28.80.
- Seller public profiles show released total earnings from completed orders.
- Buyers and sellers can report individual messages and individual uploads; reports appear in the admin dashboard.
- Admin can permanently remove listings and orders/disputes from the dashboard, and can clear all or selected audit-log records.
- Paid orders automatically release to seller balance when their five-day dispute window has expired and no dispute was opened.
