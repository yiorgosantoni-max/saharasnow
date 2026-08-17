# KYC Storage Bucket Fix

Fixed the KYC upload error:
`Bucket name not specified or invalid. Specify a valid bucket name via the storageBucket option when initializing the app, or specify the bucket name explicitly when calling getBucket().`

## Changes
- Firebase Admin initialization now explicitly sets `storageBucket` from `FIREBASE_STORAGE_BUCKET`, falling back to `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` and then the project's `*.firebasestorage.app` default format.
- KYC upload route explicitly targets the configured Firebase Storage bucket.
- Firebase App Hosting now includes a runtime `FIREBASE_STORAGE_BUCKET` variable set to `saharasnow-d518f.firebasestorage.app`.

This keeps the KYC upload flow compatible with the newer Firebase default bucket naming format.
