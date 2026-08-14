# Roamline infrastructure

Roamline must remain isolated from Zenformed and ForgeCore resources.

## Supabase

- Organization: `Roamline`
- Organization ID: `aeolmnwaiayxiwclojqn`
- Plan: Free
- Project: `roamline`
- Project ID/reference: `cjobbggzalfwtqxzbpob`
- Region: US East (Ohio), `us-east-2`
- Project URL: `https://cjobbggzalfwtqxzbpob.supabase.co`
- Storage bucket: `trip-media` (private with RLS-controlled access)

Do not reuse Zenformed or ForgeCore projects, Auth users, databases, Storage buckets, API keys, or environment variables.

Only the Supabase project URL and publishable key may use `NEXT_PUBLIC_` variables. Secret/service-role keys must never be placed in client-visible configuration.
