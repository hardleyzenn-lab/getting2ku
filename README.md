# Getting2KU realtime rooms

The index page is the sign-in and sign-up entry point. New accounts go to
`newuser.html` after registration. Me & U is the saved-history page, showing
shared answers and only the signed-in user's private vibe checks. `rooms.html`
is where players hold shared card sessions. They join using an eight-character
room code; Player 1 answers the full question set first, then Player 2 answers
the same questions. Answers for each question are shared after both players
have answered it. Choosing an answer advances automatically; players can use
Back to revisit and change an earlier answer during their turn. Room records
expire after 30 days.

## Run locally

1. Install Node.js 20 or later and PostgreSQL.
2. Create a PostgreSQL database.
3. Set `DATABASE_URL` to that database's connection string.
4. Run `npm install`, then `npm start`.
5. Open `http://localhost:3000/index.html` to sign in or sign up. After
   registration, new accounts land on `newuser.html`; use Me & U to view saved
   history and `rooms.html` to start, join, or resume a room. The room pages
   and WebSocket endpoint must use the same origin.

The server creates its required tables on startup. It intentionally exits when
`DATABASE_URL` is missing or database initialization fails.

## Deploy on Render

1. Push this project to a Git repository and create a Render PostgreSQL database.
2. Create a Render **Web Service** from that repository.
3. Set the build command to `npm install` and the start command to `npm start`.
4. Add `DATABASE_URL` to the web service using the PostgreSQL database's
   **internal** connection string. Set `NODE_ENV` to `production`.
5. Deploy the service and open its `onrender.com` URL. The same service hosts the
   HTML pages and WebSocket endpoint, so no client-side server URL is needed.

## Accounts and password recovery

Accounts are stored in PostgreSQL and can be used from different devices.
Sign-in uses an email address and a password of at least 12 characters.
Registration verifies the email address with a one-time code. Passwords and
recovery answers are stored as salted scrypt hashes; the browser stores only
the signed-in user's public profile.

Accounts have a server-managed access tier (`free`, `tier_30_day`, or
`unlocked`). Rooms use the host's tier to select and limit the card pass.
Completed rounds are saved to each signed-in player's account and appear on
Me & U. The two answers are shared; a player's private vibe check is stored
only in their own history. Me & U groups sessions by the partner's name or
handle, then shows each room's name, creation time, card count, completion
status, prompts, categories, answers, and answer times. Room names are
freeform and private to each account; changing a room name only updates the
signed-in user's room view and saved history.

Player 1 can resume a completed session to add cards up to their current tier
limit (5 for free, 15 for tier_30_day, and 50 for unlocked). The same additional
cards are then answered by Player 2. Free-tier Player 1s can watch the embedded
default YouTube video at normal speed to unlock up to 5 additional cards after
each completed pass. They can earn up to 15 added cards in a seven-day period;
after the 15th added card, they must wait seven days before watching more ads.
Rewards can extend a free session up to 50 cards total. The claim button stays
disabled until playback reaches the end and the full video duration has been
watched.

For local testing, set `NODE_ENV=development` and
`ENABLE_DEMO_ACCOUNTS=true` before starting the server. The sign-in page then
offers a free demo account and an unlocked demo account. These mock login
endpoints are disabled unless development mode is explicit. To test room
pairing, sign in with one demo account in one browser profile, create a room,
then join it from a second profile using the other demo account and the shared
code. The waiting room opens the shared cards when both users are connected.
Room membership is bound to the signed-in account as well as the browser player
ID, so room owners can resume their rooms from another device. Each demo sign-in
clears saved history for both demo accounts so testing can start fresh; saved
history belonging to regular accounts is kept. On server startup, existing
demo accounts are deleted (along with their account history); demo buttons
create fresh accounts when used.

In PowerShell, enable the local demo buttons with:

```powershell
$env:NODE_ENV = 'development'
$env:ENABLE_DEMO_ACCOUNTS = 'true'
npm start
```

Password recovery first verifies the registered date of birth and security
answer, then sends a one-time code to the registered email address. Users must
be able to access that email to reset their password.

To enable registration and password recovery, configure `RESEND_API_KEY` and
`RESEND_FROM_EMAIL` on the server. The sender address must be verified with
Resend. Without these settings, email verification and recovery return a
configuration error. Keep these values server-side; never put the Resend API
key in browser code.

The pages and account API must be served from the same Node.js server (for
example, `http://localhost:3000/` in local development). Opening an HTML file
directly with `file://` will not work. Existing local-only accounts are not
automatically migrated.
# getting2ku
