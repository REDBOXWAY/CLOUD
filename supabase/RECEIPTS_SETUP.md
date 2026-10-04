# Receipt archive setup

The RECEIPTS menu, archive, and PDF generator are implemented. Database activation is required before new sales produce archived receipts.

1. In the Supabase project used by `cloud-api.js`, open SQL Editor.
2. Run `supabase/receipts.sql` once as project owner. It checks the existing `cloud_submit` signature and applies all changes in a transaction. If it reports an unsupported signature, do not change or drop the existing sales function; inspect its argument types first.
3. Reload CLOUD DRIVE. Make one authorized test sale and verify its PDF appears in RECEIPTS and can be reopened after reloading.

Until activation, the original sales RPC remains in use and the sales page explicitly reports that the receipt archive is not connected. The archive shows a setup message, not invented records. Existing sales are not backfilled because historical checkout grouping is unavailable.

After activation, the existing `cloud_submit` operation and immutable receipt insert run in one database transaction. Retries reuse the existing request UUID. Receipt PDF bytes are saved in Supabase, and the stable authenticated `RECEIPTS.html?id=...` URL fetches those exact bytes. Users must pass the existing `cloud_read('access')` authorization to list or open receipts. Direct anonymous and authenticated table access is revoked; access is through the checked RPC functions. This follows the app's existing shared store authorization model.

The PDF has an 80 mm width and page breaks for long purchases, a cloud header, Cyrillic labels, AZN totals, date/time in Asia/Baku, and the signed-in cashier. Sample address, tax details, payment split, and fake QR code are omitted because the current sales form does not supply them. It is a store purchase receipt, without fiscal certification or fiscal-system integration.

The database was not applied automatically: this environment has no connected Supabase administration tool. Do not put service-role keys or database passwords in this repository.
