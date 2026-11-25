# Security Specification (`security_spec.md`)

## 1. Data Invariants
1. Bootstrapped administrators are strictly identified by verified email (`request.auth.token.email_verified == true` and email in `['20261ac0080020@estudantes.ifpr.edu.br', '20261ac0080019@estudantes.ifpr.edu.br', '20261ac0080070@estudantes.ifpr.edu.br', '20261ac0080030@estudantes.ifpr.edu.br']`) or presence in `/admins/{uid}`.
2. Non-admin users can only register with `role == 'player'` and can NEVER modify `role` on update.
3. `UserProfile` contains PII (`email`) and cannot be listed by non-admin users. Only verified admins may list `/users` or moderate stats/roles.
4. `uid` and `createdAt` are immutable after creation; `updatedAt` MUST equal `request.time`.
5. An `ExpeditionRun` at `/users/{userId}/runs/{runId}` requires parent `/users/{userId}` existence and verified ownership (or admin read).

## 2. Dirty Dozen Payloads (Must All Return PERMISSION_DENIED)
1. Unauthenticated `get` on `/users/userA` -> Denied.
2. Regular user self-assigning `role: "admin"` during `/users/userB` `create` -> Denied.
3. Regular user escalating `role: "admin"` during `/users/userB` `update` -> Denied.
4. Regular user calling `list` on `/users` -> Denied.
5. Spoofed admin email with `email_verified: false` -> Denied (`isVerifiedUser()`).
6. Regular user creating `/admins/userB` -> Denied.
7. Cross-user `get` on `/users/userA` by non-admin `userB` -> Denied.
8. Shadow field `create` on `/users/userA` with extra `isSuperAdmin: true` -> Denied.
9. Oversized `cartoucheName` (`> 18` chars) -> Denied.
10. Client-spoofed `createdAt` timestamp not equal to `request.time` -> Denied.
11. Orphaned `ExpeditionRun` `create` when `/users/{userId}` does not exist -> Denied.
12. Cross-user `list` on `/users/userA/runs` by non-admin `userB` -> Denied.
