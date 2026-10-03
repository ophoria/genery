# Access completion audit

Verified against the current worktree on 2026-10-03. No required implementation or verification items remain open.

| Requirement | Current implementation | Authoritative verification |
| --- | --- | --- |
| Separate Options switches for LAN and internet | `src/security/AccessSettings.tsx`; separate listener groups in `server/index.ts` | Browser settings shows both independent fieldsets; saving LAN off preserves internet enabled and removes only LAN addresses. Actual subprocess runtime suite exercises enable/disable/reopen and listener rollback. |
| LAN supports no password and password access | Scoped guest grants/role or HTTPS account login in `server/security/access.ts` and `store.ts` | Runtime transitions test actual HTTP guest and HTTPS password listeners. Browser guest enters without login; passworded LAN signs in with real TLS. Guest cannot manage users/network. |
| Internet always requires safe credentials | TLS 1.2 minimum, exact public origin, opaque Secure/HttpOnly/Strict cookies, salted scrypt N=131072/r=8/p=1, 15–128-character password validation, rate/concurrency limits | Actual trusted HTTPS tests cover secure cookies, mandatory authentication, Host checks and HTTP rejection. Lifecycle tests cover expiry, rotation, revocation, hash upgrades, malformed persistence, password/account races and throttling. No forwarded-header privilege bypass. |
| Create users only locally or on LAN | Local-owner/LAN-admin account routes; all internet account management denied | HTTP tests deny create/update/delete/list to internet administrators and normal/guest users. Lifecycle tests exercise passworded LAN account creation/removal and abort in-flight changes after logout. Browser local create/edit/remove succeeds. |
| Admin retains full gallery behavior | Server read/write policy, unrestricted administrator paths, all gallery controls; explicitly requested remote account-management restriction remains | Positive administrator deletion and full metadata import/export tests; regression suites cover existing gallery and AI behavior. Local owner UI preserves the gallery. |
| Moderator can operate without deleting source files | Metadata, copy, rename, archive, AI model installation, personal settings, analysis and owned cancellation; delete denied, outputs exclusive | Positive moderator HTTP operations and BrowserOS rating edit/Copy–Rename–Zip controls. Tests deny deletion, traversal and overwrite, preserve original sources, verify exclusive rename races and stop writes after role downgrade. App-managed AI/metadata storage remains functional. |
| Normal users can read/search/filter only | Default-deny write policy and disabled mutation controls/keyboard guards; read endpoints scoped | Every exposed mutation endpoint denied in HTTP tests. Browser shows disabled AI/batch/rating/tag/comment controls, no import/account/network forms, and metadata remains unchanged under normal-user rating shortcut. Existing filtering/search regression tests pass. |
| Restricted users stay within explicitly granted image directories/subdirectories | Canonical grants with explicit recursive flags; lexical boundaries before filesystem reads, image extension/regular-file checks, symlink rejection; current authorization rechecked while working | Direct adversarial tests cover sibling prefixes, dot traversal, nested/nonrecursive grants, symlinks, replaced roots, secrets, browse/scan/media/metadata/AI/batch destinations. Streams stop on revocation and close checked descriptors. Browser switches between allowed roots; parent and outside-grant breadcrumbs are disabled. |
| Enabled connection info with Lucide Copy | `connections.ts` uses actual private interfaces/ports and configured public origin; saved settings determine visible rows | Connection formatting tests cover IPv4/IPv6, scheme, custom port, deduplication and disabled states. Browser clipboard reads match complete LAN/public URLs. Forced Clipboard API absence verifies HTTP fallback. |
| Robust security and verification | Same-origin JSON mutations, Host checks, default-deny routes, atomic private persistence, transactional listener changes, bounded login/work queues, request timeouts and connection limits; decoder limits and disconnected-task cleanup | 39 security tests plus 21 regression tests: 60/60 pass. Latest `npm run build` and `git diff --check` pass. Login body and oversized thumbnail tests reject before expensive work; queue capacity/FIFO/abort/timeout tests pass. Model install stops on revoked authority; stale account updates cannot commit. |

## Browser and design evidence

BrowserOS neo exercised an isolated preview with temporary users, image roots, metadata and test certificates. Only loopback preview listeners were used; the user's stored access settings/accounts were not changed. The preview was stopped, temporary data removed, test tabs closed, and test certificate/permission overrides reset.

- [Desktop Options](screenshots/access-desktop.png)
- [Mobile Options, 390×844](screenshots/access-mobile.png)
- [Mobile account form](screenshots/access-account-mobile.png)

Independent impeccable finish reviewer final disposition: **ship**. LAN helper custom-port mismatch: resolved. Mobile text-action sizing: resolved. Remaining material findings: clear. The shipped reviewer definition was unavailable; the independent reviewer used the skill's degraded finish-reviewer definition. The documenter recorded the built Access/sign-in world in DESIGN.md, design.json and the incumbent surface brief without replacing unrelated design records.

## Final checks and deployment prerequisites

Final combined test command:

```sh
npx tsx --test scripts/security.test.ts scripts/security-runtime.test.ts scripts/security-lifecycle.test.ts scripts/security-streams.test.ts scripts/security-work.test.ts scripts/connections.test.ts scripts/ai.test.ts scripts/ai-ui.test.ts scripts/metadata-import.test.ts scripts/folder-sorting.test.ts scripts/thumbnail-settings.test.ts
```

Result: 60 tests, 60 pass, 0 fail. `npm run build` passes TypeScript and Vite. No commits or deployment were requested or performed; pre-existing dirty gallery/AI changes are preserved.

Remote listeners serve the production build (`npm run serve`). Passworded LAN/internet require configured, client-trusted TLS certificate/key; internet also requires the configured public HTTPS origin to be reachable through the user's routing/firewall setup. These are deployment inputs, not unfinished code or test gates. Network access defaults off and user configuration was left intact.
