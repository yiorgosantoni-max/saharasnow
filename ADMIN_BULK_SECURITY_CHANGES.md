# Admin bulk/security changes

- Orders & disputes now support **Select all** and **Delete selected**, matching the audit-log workflow.
- Added **Force logout all buyers & sellers** in the Users admin tab.
- Force logout revokes Firebase refresh tokens for every non-admin account, so their existing sessions are rejected by `userFromRequest(..., true)` and cannot create Stripe checkout sessions.
- The administrator account configured by `SUPER_ADMIN_EMAIL` is excluded.
- Bulk actions are recorded in the audit log.
