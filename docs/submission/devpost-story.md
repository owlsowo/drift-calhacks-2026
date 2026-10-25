## Inspiration

Meeting someone at a big event often starts with the hardest part: finding something to say. We wanted to make that first interaction smaller, stranger, and more playful.

Drift begins with a message in a bottle. One person writes six words. Someone else adds six more. They leave with a tiny story that neither would have written alone.

## What it does

Drift is a daily co-op writing game where two strangers turn two six-word lines into a postcard they both keep.

Arrive at a moonlit shore, catch a bottle, and unfold another writer’s beginning. Today’s prompt might ask why they were banned from the aquarium. Your job is to write the aquarium’s official response in exactly six words. Seal the postcard, and the original writer receives the same finished story live, without refreshing.

Keep it in your collection, download the image, or share its link. Then, if you want, toss your own beginning for the next person. You can also write first. Drift supports three rounds per day and awards one daily completion stamp.

The interaction stays small on purpose: no profile to perfect, two short contributions, and something tangible to keep.

## How we built it

We built the mobile web experience with React, TypeScript, and Vite, hosted over HTTPS on Cloudflare. A photographed sea, an original bottle, and a continuous unfolding paper surface make catching a story feel like a small ritual. Native WebGL adds water and paper motion; static and CSS fallbacks, reduced motion, and keyboard controls keep the core game usable without those effects. Browser Canvas exports the actual approved text as a postcard.

SpacetimeDB is the game server and source of truth. It assigns each bottle exclusively, keeps unfinished text and author relationships private, and publishes the postcard, authorship, and round completion atomically. Subscriptions deliver the result to both writers. Saved drafts and reconnect support help a writer recover their place.

Claude has two bounded roles. Haiku 5.5 checks a beginning before delivery and the combined story before publication. Sonnet 5.5 can suggest a writing direction using the caught setup and current draft. People supply both creative lines. Model calls run on the server, outside database transactions; the server rechecks the live claim before accepting the result.

We also implemented server-side Turnstile verification, request and dispatch limits, reporting, author removal, and scheduled retention. Approved anonymous postcard text is public and shareable; raw requests and identity mappings stay private.

## Challenges we ran into

The difficult part was making one shared result survive two guests, expiring catches, retries, and an external model. Claude might finish checking a reply after the bottle has expired or changed hands. A successful model response cannot be enough to publish it.

We persist each request before dispatch and bind it to the caller and exact text. Finalization rechecks ownership, claim version, deadline, withdrawal, and pause state. Only then can one transaction publish the postcard and update both writers’ ownership. Uncertain checks withhold publication and preserve the draft.

Hosting exposed another integration problem: the SpacetimeDB browser SDK’s generated serializers conflicted with our Content Security Policy. We built and tested an interpreted serialization adapter that preserves the wire format while keeping dynamic code evaluation disabled.

## Accomplishments that we are proud of

The game completes the exchange from a caught beginning to a shared postcard, with collection, PNG export, link sharing, reporting, and author removal.

A hosted two-browser run verified real Claude moderation, a contextual Sonnet hint, the live postcard return, and a downloadable PNG. The newer catch-first path also passed an isolated local browser test. Those runs used synthetic writers, not attendees. The hosted exchange preceded Turnstile activation; separate hosted checks confirmed rejection of forged tokens and unverified writers, while a full normal-user run through the enabled challenge remains to be checked.

At this checkpoint, 43 server tests and 14 rule, model-contract, gesture, draft, serialization, and scheduling tests pass. TypeScript checks and the production build also pass. Documented browser scans found zero automated accessibility violations in the tested states and viewports.

A live 50-case synthetic model evaluation returned 50 structurally valid outputs. Moderation agreed with 35 of 36 development labels; the remaining case conservatively withheld harmless instruction-like text. Fourteen hints received an agent review for grounding and authorship boundaries. This evaluation is an engineering check, not a user study or a safety guarantee.

## What we learned

The finished postcard explains Drift better than a matching score or a long onboarding flow. Designing backward from that artifact clarified the rest: one exclusive catch, two human contributions, and a result both people can trust.

We also learned that AI assistance needs a precise boundary. A useful hint opens a possibility while leaving the surprising line to the person holding the bottle.

## What is next

Next we will verify the current hosted flow through the enabled bot challenge on physical phones, improve hint tone, prepare human-written starters for quiet rooms, and run a small attendee pilot.

Our intended audience is first-time event attendees who would enjoy a creative interaction before an introduction. We want to observe whether they finish comfortably, share their postcard, and return for another round. We have not yet conducted that pilot or measured social outcomes.
