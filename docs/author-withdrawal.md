# Author withdrawal and live draft recovery

A beginning's original author can open its Bottle ID controls and choose **Withdraw this bottle**. A native confirmation explains that the beginning, every associated reply, public links and both writers' collections will become unavailable; saved images/screenshots cannot be recalled, and a daily turn is not refunded. Cancellation does nothing before dispatch. While dispatch is pending, the dialog cannot imply cancellation. The confirmation is bound to that exact bottle and closes if another author tab withdraws it.

The `withdraw_my_beginning` reducer checks the private bottle owner against the authenticated sender, then reuses `hideBeginning` in one transaction. Public IDs, shelf cookies, reply coauthorship and administrator identity are not authority for this action. No writing pass or open service is required to withdraw. The change adds a reducer only, with no stored schema expansion. Repeating it as the original author is safe.

Existing paid-result validation rejects an in-flight reply or Hint if its beginning has been hidden. A provider request already dispatched may still finish and incur its recorded cost; withdrawal cannot undo that call. The response cannot republish the story. Existing hidden-card cleanup and ordinary retention still apply.

Connected readers lose the public beginning and associated pairs through their subscriptions. A writer with a pending ending sees an unavailable notice, disabled Send/Hint and a Copy my draft action; the draft and focus stay intact. Catching another bottle reuses the same current-day round without using its skip. If the old round belongs to a previous day, recovery closes it before starting today's catch. Earlier local drafts remain on their own keys under the existing seven-day retention.

## Validation scope

- Eight new server cases cover original-author permission, outsider/coauthor/admin denial, multiple linked pairs/hello/unread removal, idempotence/quota/unrelated work, paused/expired-pass access, held/future assignments, pending reply/Hint and cached retries, and sample/missing denial. Full server suite: 87 passing tests.
- The browser suite uses real disposable local databases and synthetic stories, with AI disabled. It checks five identities plus a second author tab, copied ID-only cookies, cancellation/focus, blocked cancellation after dispatch, lost acknowledgement, live removal, retained focused text, actual replacement assignment and reload/idempotence. Previous-day client state is injected to exercise recovery; it is not an overnight/physical-phone claim.
- No production story is withdrawn as a test. Hosted release evidence is recorded separately after publication.

This adds deliberate author control to the human collaboration and Claude-failure story, and demonstrates core Spacetime live propagation. It is product evidence for the People-First/connection case, not a claim of award eligibility or measured social impact.
