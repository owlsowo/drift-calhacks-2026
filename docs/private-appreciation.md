# A little thanks between co-writers

Either original writer of a completed human story can deliberately send one private thank-you. Its counterpart sees “Your co-writer sent a little thanks” on that exact pair, with a marker in My bottles. New receipts arrive live without moving a focused draft; receipts sent while a page is closed remain available on return without pretending they just arrived. Reading does not send thanks. Samples and team starters do not invent a person to receive one.

The paper holds the control and private receipt, while Copy text and the PNG renderer continue to use only the story data. Public links and ID-only shelf cookies reveal neither the control nor its private state. There is no new free-text channel, contact exchange, public popularity score, read timestamp or AI call.

## Storage and permission boundary

- `thank_co_writer({cardId})` checks the existing private authorship and visible human postcard. Original, distinct authenticated authors are the only permitted senders. Paused writing or expired writing verification do not prevent this action on an existing story.
- A private bit (`32`) in the existing `setupActions` or `replyActions` records each author's sent acknowledgement. It is outside `CARD_ACTIONS`, adds no analytics event, and preserves all earlier flags. Repeats are idempotent. Quota, costs and creation times remain unchanged.
- The additive sender-scoped `my_appreciation` view exposes only `{cardId, sent, received}` for the caller's eligible pairs. Old `my_cards` and public postcard shapes remain unchanged. No stored column or table is added.
- Hidden, withdrawn and author-reported stories disappear from the view. Existing published/hidden-card retention removes the owning authorship record; sending thanks does not extend it. The sender also checks the thirty-day age limit immediately.

## Validation

Thirteen new backend cases cover independent/mutual receipts, outsider and malformed/sample/team denial, repeated sends, old flag preservation, no analytics/AI/quota changes, old view shape, paused service, hide/report/withdraw and retention. The complete server suite passes 100 checks.

Browser checks use real disposable local subscriptions and synthetic writers with AI off. They exercise a deliberate send, cookie-only denial, focused-draft arrival, response loss, multiple author tabs, mutual acknowledgement, reload, a closed recipient returning, independent endings, actual image download and live hiding. Clipboard and lost acknowledgements are injected; desktop Chrome/WebKit do not establish physical-phone native sharing. Accessibility scans and visual captures cover the note layout. Hosted schema/readback checks remain separate from local multiwriter evidence.

A quiet reciprocal gesture strengthens the human-connection and real-time demo. That is a product argument, not a claim that a receipt establishes friendship, measured impact, or award eligibility.
