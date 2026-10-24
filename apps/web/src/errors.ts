// Spacetime procedures can reject with an application string, rather than Error.
// Show only our bounded, action-oriented messages; keep transport internals out of gameplay.
export function friendlyError(
  error: unknown,
  fallback = 'Something went adrift. Your draft is saved.',
) {
  const message = typeof error === 'string' ? error : error instanceof Error ? error.message : '';
  if (
    message.length <= 400 &&
    /^(This |The tide |Your |You’ve |You’re |Catch |Toss |Three |That |Only |Keep |Use |No bottles|Saying hello|Choose |AI guidance |Story checks |Couldn’t |Reconnect |We couldn’t |Try )/u.test(
      message,
    )
  )
    return message;
  return fallback;
}
