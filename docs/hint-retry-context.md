# A hint stays with its bottle

A reproduced server regression returned a successful cached hint from an earlier assignment after the writer skipped. The new assignment's stored hint was not overwritten, but its retry could misleadingly succeed without guidance for the current beginning.

New reply/hint retry records now include the server assignment ID and version. The same assignment and text preserve the original request ID through reload and uncertain transport. A skip or expired rebind gets a fresh ID for an explicit new action. Older cached records without metadata keep their ID for an authoritative replay; the server rejects an earlier-version receipt without redispatching it or changing the new round. A late response also cannot erase a newer pending record. Existing seven-day expiry and provider caps are retained.

Hint waits have a 30-second UI deadline that restores controls and preserves the draft/retry ID. Completed replies can unlock their exact postcard through the authoritative subscription even if the procedure response never resolves. Leaving the writing view before a late commit keeps the chosen view; the completed pair remains in My bottles.

Verification: 79 server checks include same-context deduplication, skipped/expired hint rejection, unchanged new-round state, and the existing completed-reply replay. Seven local cases per Chrome/WebKit cover lost hint responses/reload, unchanged draft across skip, late-record cleanup, legacy cache migration, actual local reply commit/replay, never-resolving reply acknowledgement, navigation and Hint timeout/retry. Six retention cases per engine preserve expiry and duplicate prevention. Hint transport receipts and clocks are injected; assignment and reply transitions execute against a disposable local database. No paid model call or production story is created by these tests. Hosted hint quality remains a separate check.

There are no new stored backend fields or API signatures. This is a retry/confirmation correction, not additional model evaluation or a budget increase.
