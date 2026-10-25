# Invite someone to finish a beginning

An author opens a released beginning in My bottles and presses **Invite someone to finish**. The copied link contains only the existing public bottle ID. A recipient sees the beginning and daily theme, then explicitly chooses **Write an ending**. Merely viewing the link consumes no round. Normal Pick up remains random; invitations are an optional route to the same private writing assignment and public shared postcard.

The new `pick_up_beginning` reducer selects an approved public beginning by ID. It uses the same assignment finalizer, daily quota, moderation, deadline, request accounting and publication path as random pickup. The server rejects self-replies, duplicates even after a card is hidden, missing/hidden/nonpublic beginnings, previous skips, old-day invitations, paused dispatch and an absent/expired shore check. A valid existing assignment resumes without extending its deadline, including across midnight. A different unexpired assignment cannot be silently replaced. An independent write round is preserved.

The author sees an invitation control only through private outgoing ownership. Public bookmark cookies grant reading, not authorship. The public heading no longer calls another writer's beginning “Your bottle.” Recipients with a different open bottle get a resume action for that draft; recipients at today's limit can still read the beginning and replies. Cancellation and reload preserve the selected assignment and draft. Sharing remains available for archived beginnings as a read-only bottle link.

## Verification

- Nine new server tests cover exact selection/two writers, lease-preserving midnight resume, self/missing/nonpublic rejection, independent drafts and active-assignment protection, skip/report boundaries, completion/hidden-card duplicates, daily quota, shore/pause controls and in-flight requests. All 75 server tests and 27 unit tests pass.
- Seven Chrome and seven WebKit browser checks cover actual author/recipient actions, no-round-on-read, cancel/resume/reload, two separate returned pairs, an existing open draft and the shared daily quota. The clipboard adapter is injected; database state, assignments, reloads and subscriptions are real within an isolated local sandbox. Test words use the current prompt's development examples and other labeled synthetic fixtures. No provider calls or attendee outcomes are established.
- The current ten-check Chrome letter suite, selected accessibility scans, build and typechecks pass. See `invitation-{chrome,webkit}.json` and `invitation-*.png`.

This adds a reducer and client binding; it changes no persistent table schema and requires no data reset or new backfill. Production release must keep the existing database identity and publish with `--delete-data=never`, then verify before/after rows and served assets. The local synthetic flow is not proof of a new hosted multi-writer Claude flow. Bot protection and the evaluation budget remain unchanged.

## Product reason

The direct invitation is the leading recommendation in both sourced winner reviews: shorten the path from a recognizable action to a visible shared result. It makes the human contribution and SpacetimeDB's live return easy to demonstrate for Meta/connection and general/creative judging. Claude continues to check shared content and optionally guide the human writer. This does not add a sponsor logo or establish track eligibility, social benefit or numerical award odds.
