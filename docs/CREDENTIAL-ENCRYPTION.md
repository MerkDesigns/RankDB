# Credential storage and optional encryption

Current user decisions: start with plain storage, then allow an optional master password for
**email and password fields only** (2026-10-30). Export/import and all backup features have been
removed/deferred. The old Windows-key (DPAPI) storage was dropped entirely on 2026-10-31, after the
user's data had been converted.

## Old Windows protection (dropped)

Fresh databases are plain. No first-run password prompt, Credential Manager entry or data.key file
is created. Schema migration 4 marked databases with credential values from schema 3 as `legacy`
(sealed with a DPAPI-protected data.key); that migration is unchanged. A mandatory one-time
conversion to plain existed until 2026-10-31 and has been removed with all DPAPI code: a database
still in `legacy` mode is refused at startup (the startup problem screen), and nothing is changed.
Old key files on disk are preserved but never read.

## Optional master-password behavior

Settings → Data → Credential protection offers Enable encryption. Only saved email/password fields
are encrypted; names, ranks, currencies, notes, history and settings remain plain. New passwords
require 8–1024 characters and confirmation. Enabling protection leaves the session unlocked.

Password-protected credentials start locked after every app restart. Ordinary account management
still works. Copy/edit credentials prompts to unlock, then resumes; cancellation does not perform
the action. Rust also enforces the credential lock. Settings offers Unlock, Lock now, Change
password and Turn off. Changing/disabling always verifies the current password, even while unlocked.
There is no idle/Windows-lock auto-lock policy and no forgotten-password reset or recovery bypass.

## Storage and cryptography

The single-row credential_security table stores mode (plain / legacy / password) and, for password
mode, the wrapped key envelope. Protection is database metadata, not a normal app setting.

| Mode | Email/password bytes | Runtime use |
| --- | --- | --- |
| plain | UTF-8; NULL for missing values | No key dependency |
| password | AES-256-GCM fields | User master password unlocks the data key |
| legacy | DPAPI-keyed fields of early dev builds | Unsupported: the database is refused at startup |

A random 32-byte data key encrypts fields with fresh 12-byte nonces and authenticated associated
data rankdb:<account-id>:email or rankdb:<account-id>:password. Bytes are nonce || ciphertext ||
16-byte authentication tag, preventing field/account substitution.

The master password derives a wrapping key with PBKDF2-HMAC-SHA256, 600,000 iterations and a random
16-byte salt. AES-256-GCM wraps the base64 data key with associated data rankdb:credential-key:v1.
The version-1 envelope has version, iterations, salt and sealedKey (base64 byte strings). Version,
iteration count and decoded lengths are validated before derivation. No clear key/password is
stored. Wrapped-key authentication verifies the password; there is no separate verifier.

Password changes rewrap the same data key with a fresh salt/nonce rather than rewriting fields.
Enable/disable converts fields and metadata transactionally. Database connection locking serializes
credential writes and protection changes. Keys/password buffers use zeroize; AES-GCM clears key
material on drop. This does not promise erasure of every OS/runtime memory copy.

SQLite uses secure_delete=ON, and protection changes checkpoint, VACUUM and checkpoint the current
DB/WAL. Post-commit cleanup failure explicitly reports that protection has already changed.
Copies taken before schema upgrades (`upgrade-copies/`) keep the credentials in whatever mode they
had then. Historical files, filesystem snapshots
and storage remanence are outside this cleanup.

## Removed/deferred features

There are no export/import/restore dialogs, installed RankDB 0.3 import, backup island/history,
automatic daily snapshots or pre-update backups. Associated Rust modules and command registrations,
Windows Credential Manager access and the file-dialog plugin/permissions were removed. Existing
files on disk are not deleted. These features may be designed again after a future user request.

## Validation

Isolated Rust tests cover fresh plain mode, master-password operations and wrong passwords,
field binding, corrupt-row rollback and refusing a `legacy` database untouched. Frontend tests
cover prompt, cancel/resume and stale-status protection. Live UI checks and current user data
state are recorded in HANDOFF.md.

References: [RustCrypto AES-GCM](https://docs.rs/aes-gcm/0.11.1/aes_gcm/),
[zeroize](https://docs.rs/zeroize/1.9.1/zeroize/),
[OWASP derivation guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).
This is an implemented, tested design, not an independent cryptographic audit.
