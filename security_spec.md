# Security Specification - TenTen Walkie

## Data Invariants
- A `VoiceClip` must belong to a sender and a receiver who are friends (accepted friendship).
- A `Friendship` must involve the creator of the record.
- Users can only update their own status and presence.
- `createdAt` fields are immutable and must match server time.

## The "Dirty Dozen" Payloads (Attack Vectors)
1. **Identity Theft (User)**: Attacker attempts to update another user's `displayName` or `status`.
2. **Identity Theft (Voice)**: Attacker attempts to send a `VoiceClip` as another user (forging `senderId`).
3. **ID Poisoning**: Attacker sends a 2MB string as a document ID for a `voice_clip`.
4. **Relationship Poisoning**: Attacker creates a `Friendship` where they are not a member of the `users` array.
5. **PII Scraping**: Attacker tries to list all `users` to harvest emails.
6. **State Shortcut**: Attacker tries to update a `Friendship` status they didn't create or without proper auth.
7. **Playback Spoofing**: Attacker marks a `VoiceClip` as `played` even if they are not the receiver.
8. **Shadow Update**: Attacker adds `isAdmin: true` to their user profile.
9. **Timestamp Forgery**: Attacker sends a `createdAt` date from 10 years ago to bypass TTL limit (if any) or mess up ordering.
10. **Orphaned Writes**: Attacker sends a `VoiceClip` to a non-existent user ID.
11. **Resource Exhaustion**: Attacker sends an extremely long `audioUrl` (1MB string).
12. **Status Locking Bypass**: Attacker tries to change a friendship from `accepted` back to `pending`.

## Test Scenarios
- `test_unauthenticated_denies_all`: Verifies `false` for any non-auth access.
- `test_user_can_create_own_profile`: Verifies `true` for self-registration.
- `test_user_cannot_update_others_profile`: Verifies `false`.
- `test_friendship_requires_participation`: Verifies `false` if `request.auth.uid` not in `resource.data.users`.
- `test_voice_clip_sender_must_be_auth`: Verifies `true` if `senderId == request.auth.uid`.
- `test_voice_clip_update_restricted_to_played_field`: Only receiver can update `played` field.
