# Roamline Functionality Contract

This document is the product completion gate for Roamline. A control is not complete because it renders or animates. It is complete only when its real action works, its loading/error/empty states are handled, authorization is enforced, and the relevant flow has been verified in a browser.

## Status key

- `[ ]` Not implemented or not verified
- `[~]` Partially implemented; must not be described as complete
- `[x]` Implemented and verified
- `N/A` Deliberately removed from scope; include the reason

## Rules

1. Every visible button, link, menu item, card, form, reaction, and media control must appear in this file.
2. Every successful create/edit/delete confirmation closes its modal; failed actions keep the modal open and show an actionable error.
3. Placeholder controls must be disabled and labeled as unavailable, or omitted. They must never look active while doing nothing.
4. Destructive actions require confirmation and a recoverable/error state where practical.
5. Authenticated actions must be protected in both the interface and Supabase policies.
6. Every completed flow must be checked on desktop and a mobile viewport.
7. Browser back/forward, direct URLs, refresh, loading, empty, unauthorized, and failure states are part of the flow.
8. We do not call the application finished while any in-scope item remains `[ ]` or `[~]`.

## Current UI audit — known nonfunctional controls

These controls exist in the first visual shell and must be wired, disabled, or removed before the next milestone is called complete.

### Global header

- [x] Roamline logo returns to `/` from every implemented page.
- [x] Home search expands from the header, filters the currently authorized trip feed by name while typing, shows a no-results state, and clears when closed.
- [x] The hamburger is the far-right control after Search on desktop and mobile; authenticated menus contain account identity, Your trips, All trips, and Sign out, while signed-out menus expose All trips, Sign in, and Create account.
- [x] Sign in opens `/login` and changes to authenticated header actions after authentication.
- [x] New trip is a floating home-page pill—bottom-right on desktop and bottom-center on mobile—and opens `/trips/new`; unauthenticated users are sent through login and returned afterward.
- [x] The trip library avoids a redundant middle-page New Trip action; creation remains available in the header, empty state, and bottom call-to-action.
- [x] The home hero headline holds two intentional desktop lines without orphan wrapping, and the trip library follows without excess vertical spacing.
- [x] The primary navigation remains sticky at the top across home, trip, and form pages with a translucent backdrop and mobile-safe spacing.
- [~] The navigation theme toggle persists light/dark preference, honors the system preference on first visit, prevents initial theme flashing, and themes primary pages, cards, forms, dialogs, controls, and empty/error states; desktop home/trip/Add Moment/media-viewer verification is complete and a physical mobile-device pass remains.
- [x] Floating Add moment and New trip pills invert to white with dark text in dark mode so their labels and icons remain clearly visible.
- [x] Share uses the native share sheet where supported and a copy-link fallback elsewhere.
- [ ] Follow requests notification permission only after an explanatory prompt and saves the subscription.

### Home page `/`

- N/A Featured mock trip was removed; the home page now uses real trip records only.
- [x] Link previews use a designated branded 1200×630 Roamline Open Graph image instead of allowing messaging apps to scrape the first public trip photo.
- N/A Mock “Open journey” control was removed with the mock featured trip.
- [x] Trip cards load real authorized/public trips and open the correct trip.
- [x] Every trip uses the original cinematic featured-card treatment with an automatically derived asymmetric backdrop of up to five real album photos and a designed no-photo fallback.
- [~] Public and private access rules are verified; remaining status/date filtering is not yet implemented.
- [x] Home defaults strictly to public journeys in reverse chronological trip-date order; private and link-only journeys are excluded even for signed-in viewers, while the account menu switches to an owner/member-only Your trips view.
- [x] “Start a new trip” opens the trip creation flow.
- [x] Empty trip-library state provides working create/sign-in actions.
- [ ] Loading and database-error states have retry behavior.

### Trip page `/trip/[slug]`

- [x] The slug loads the correct trip; unknown or inaccessible slugs show the proper 404/permission state.
- [x] Owners see a small pencil-only Edit Trip control between the trip title and Play Journey button; it is absent for non-owners and does not occupy navbar space.
- [x] The Google map renders real trip locations and a chronological route from multiple check-ins.
- [x] The trip header shows accepted travelers as overlapping, distinctly colored initial avatars with names available as labels/tooltips and an accurate traveler count.
- [~] Trip owners have an Edit Trip settings page for changing name, URL, dates, description, and public/link-only/private visibility; owner authorization and prefilled browser rendering are verified, while a live save is deliberately non-destructive pending a user-directed edit.
- [~] The Play Journey control opens a full-screen oldest-to-newest story with ten randomly selected licensed songs, non-repeating session selection, photo timing, video playback, previous/next, pause, skip-song, mute, progress, and close controls; a real uploaded video was verified autoplaying with its audio at 20% beneath music at 42%, while a physical mobile touch pass remains.
- [x] Trip Story transitions use a soft fade and alternating slow zoom/pan motion on photos, while videos fade without artificial zoom; reduced-motion preferences disable animation.
- [x] The mobile Play Journey button is vertically centered against the trip title, and its triangular play glyph is optically centered inside the circle.
- [x] Trip Story’s mobile playback, navigation, song-skip, and mute controls are centered as one evenly spaced group inside the control pill.
- [x] Mobile Trip Story shows the current music note, song title, and artist in a centered label immediately above the playback controls.
- [~] Map pins scroll to the corresponding timeline item; live Google verification remains.
- [~] Timeline location controls focus the corresponding map pin; live Google verification remains.
- [ ] Expand map opens and closes a usable expanded map.
- [~] Add moment opens the contributor dialog and signed-out viewers get a working sign-in action; mobile verification remains.
- [ ] Follow/unfollow saves notification preferences for the current trip.
- [ ] Share produces the canonical public trip URL.
- [ ] Contributor avatars open a contributor list.
- [ ] Date/day navigation works for long timelines.
- [ ] Pagination or infinite loading loads additional days without duplicates.
- [ ] Public, unlisted, private, draft, and archived trip access behave correctly.

### Check-ins

- [~] Add moment opens the check-in form; a dedicated shortcut is not currently shown.
- [x] The check-in form supports editable past or current date/time.
- [x] Google Places autocomplete returns suggestions and populates name, address, place ID, latitude, and longitude.
- [~] “Use my current location” requests permission at action time and reverse-geocodes the result; live permission verification remains.
- [x] Denied/unavailable location permission has a Google place-search and manual-coordinate fallback.
- [~] A check-in can include an optional note and multiple attached photos/videos; the live database migration and picker UI are verified, while a real attachment upload fixture remains.
- [x] Google Places check-ins display the place's first available Google Maps photo as a thumbnail with a neutral fallback when no photo exists.
- [x] Submit displays progress, prevents duplicate submission, and reports errors; a real check-in mutation was browser-verified.
- [~] Successful creation requests a live route refresh; reliable post-mutation rendering is still being hardened.
- [~] Trip owners can edit/delete every trip check-in; contributors can manage only check-ins they authored. Browser mutation verification remains.
- [x] Check-in delete uses a styled, accessible Roamline confirmation modal rather than a browser/system alert.
- [x] Check-in management controls contain only working, authorized actions.

### Photo and video uploads

- [~] Add moment supports multi-select and desktop drag/drop; mobile browser verification remains.
- [~] Each uploaded photo/video offers Google place autocomplete and manual latitude/longitude entry; when no place is selected, approved Google reverse-geocoding converts manual or EXIF GPS coordinates into a stored city/country label used by the timeline and Trip Story. Live EXIF and manual-coordinate fixtures remain to be verified.
- [x] Supported file types and the 500 MB per-file limit are shown and validated.
- [x] Uploads use trip/user/UUID object paths with upsert disabled.
- [x] Files 6 MB and larger use Supabase's TUS resumable upload endpoint.
- [~] Each file shows extracting, ready, uploading with progress, complete, and failed states; server-side processing is not currently required.
- [~] Batch upload tracks per-file progress and retries failed items without re-uploading completed items; aggregate progress remains.
- [~] EXIF capture time and GPS are extracted when present; fixture verification remains.
- [~] Browser-available video dimensions and duration are extracted; embedded video GPS is not yet supported.
- [x] Missing or stripped GPS metadata is clearly indicated.
- [ ] Users can assign a Google Place to one item or the entire batch.
- [~] Users can edit caption, capture time, and place name before publishing; coordinates come from EXIF or a manual check-in.
- [~] Trip owners can edit every media moment; contributors can edit their own caption, capture time, place, and coordinates. Browser mutation verification remains.
- [~] Removing queued uploads leaves no database rows; closing during an active upload still needs explicit cancellation.
- [~] Media delete uses the styled Roamline confirmation modal and removes the database record followed by the private Storage object; live destructive verification remains.
- [ ] The timeline and map update after publishing without a hard refresh.

### Media gallery and viewer

- [x] Clicking a photo opens the correct item in a full-screen viewer.
- [~] Video playback is implemented in the viewer; a real video fixture remains to be verified.
- [~] Previous/next controls wrap in timeline order; multi-item browser verification remains.
- [x] Keyboard arrows and native dialog Escape behavior work on desktop.
- [ ] Mobile swipe navigation works or is deliberately replaced with obvious tap controls.
- [ ] Viewer close returns focus and scroll position to the originating media card.
- [~] Captions, capture time, location, reactions, and comments show real data; contributor display remains.
- [ ] Location opens/focuses the correct map pin.
- [ ] Video play, pause, mute, scrub, duration, and fullscreen controls work.
- [ ] Missing/deleted media has a graceful unavailable state.
- [x] Authorized edit action opens the correct media editor.
- [~] Owners/contributors can long-press manageable media on touch, mouse, or pen to enter one trip-wide multi-select session, then select media across different date groups, see one combined count, clear selection, and request bulk deletion; selection circles stay hidden on touch devices until that first long-press activates selection, then appear on all manageable media across the trip. Cross-date non-destructive browser verification is complete and live bulk deletion remains deliberately untested against real trip content.
- [x] Bulk delete uses the styled Roamline confirmation and removes selected database rows and private Storage objects.

### Reactions

- [x] Reaction controls display the supported emoji choices in the media viewer.
- [x] Timeline photo/video cards show a compact summary of saved emoji reactions and the total reaction count.
- [x] Reaction and moment-edit changes update the timeline card immediately and remain synchronized after the media viewer closes.
- [x] Selecting an emoji creates or changes the current user’s reaction.
- [x] Selecting the active emoji removes the reaction.
- [x] Counts update immediately and reconcile with the database result.
- [ ] A signed-out user is prompted to log in and returned to the same media item.
- [x] The media/user database key and upsert prevent duplicate reactions.
- [x] Reaction failures roll back optimistic UI and show a useful message.

### Comments

- [x] Opening media displays its correct comment panel/thread.
- [x] Authenticated users can submit comments and persisted comments reload under the correct media item.
- [x] Empty comments and loading states are designed and browser-verified.
- [x] Submit disables during posting and reports failures.
- [~] Users can delete their own comments with confirmation; editing remains.
- [ ] Trip owners can moderate comments if retained in scope.
- [x] Comment delete uses the styled Roamline confirmation modal rather than a browser/system alert.
- [ ] Signed-out viewers can read allowed comments but are prompted to log in before posting.

### Authentication and account

- [x] `/login` supports email/password sign-in.
- [x] Registration creates an account and profile.
- [ ] Invalid credentials and network errors are explained without exposing sensitive details.
- [x] Sign out works and clears authenticated UI immediately.
- [x] Refresh preserves valid sessions.
- [x] Protected routes preserve the intended return URL through login.
- [ ] Account menu links and actions all work.
- N/A Password reset is intentionally absent from the MVP UI.
- [x] Supabase service-role/secret keys are never exposed to the browser.

### Trip creation and editing

- [~] `/trips/new` validates name, slug, dates, description, and visibility; cover upload remains.
- [ ] Slug availability is checked and conflicts provide usable alternatives.
- [ ] Cover upload shows progress, retry, replace, and remove actions.
- [x] Create prevents duplicate submissions and routes to the new trip on success.
- [ ] Owner can edit trip name, description, dates, cover, route summary, and visibility.
- [ ] Settings save reports saving, success, and failure states.
- [x] Public trips appear on the public home page.
- [ ] Unlisted trips work by link but do not appear publicly.
- [x] Private trips are accessible only to members.
- [ ] Archive and restore work.
- [ ] Delete requires explicit confirmation and handles associated database/media cleanup.

### Contributors and invitations

- [~] Owner can open the contributor invitation dialog; full member management remains.
- [x] Owner can create and copy a contributor invitation link.
- [~] Invite tokens are scoped to one trip and expire after 30 days; owner revocation UI remains.
- [~] The invitation preview and acceptance mutation are implemented; second-account acceptance verification remains.
- [x] Accepting again is idempotent and does not create a duplicate membership.
- [ ] Owner can remove a contributor after confirmation.
- [ ] Contributors can leave a trip after confirmation.
- [ ] Owners cannot accidentally remove the final owner.
- [x] Member roles and invitation creation are enforced by Supabase RLS, not only hidden buttons.

### Notifications and PWA

- [ ] Web app manifest, icons, theme colors, and standalone mode are valid.
- [ ] Install prompt works where supported.
- [x] The app ships a web manifest, standalone metadata, icons, and service worker; eligible Android browsers receive a native Install action, while iPhone users receive Safari Share → Add to Home Screen instructions before notification opt-in.
- [x] PWA service-worker registration is production-only; local development unregisters stale workers and removes Roamline caches to prevent old client bundles from causing hydration mismatches.
- [ ] Notification prompt is triggered by a user action, not automatically on page load.
- [ ] Granted, denied, dismissed, and unsupported permission states are handled.
- [ ] Push subscriptions are stored per device and trip/member as designed.
- [ ] New check-in notification opens the correct trip/check-in.
- [ ] New media-batch notification opens the correct trip/day.
- [ ] Batch uploads produce one useful notification, not one per file.
- [ ] Users can independently toggle check-in and media-batch notifications.
- [ ] Unfollow removes or disables the correct subscription.
- [ ] Expired push subscriptions are cleaned up after delivery failures.

### Accessibility and interaction quality

- [ ] Every icon-only button has an accessible name.
- [ ] All dialogs/sheets trap focus and restore it on close.
- [ ] All core flows are keyboard usable.
- [ ] Visible focus states are present.
- [ ] Touch targets are at least 44×44 where practical.
- [ ] Disabled controls are visually and semantically disabled.
- [ ] Form errors are connected to their fields and announced appropriately.
- [ ] Images have meaningful alt text or are intentionally decorative.
- [ ] Motion respects reduced-motion preferences.
- [ ] Color contrast is acceptable in normal, hover, disabled, and error states.

### Data integrity and security

- [x] RLS is enabled on every exposed application table.
- [x] Anonymous users can read only published public trips; private and unlisted trips are denied.
- [~] Membership-based write policies are active; trip creation and check-in creation are verified, while a browser-driven file fixture remains for uploads.
- [ ] Users can edit/delete only content allowed by the product roles.
- [x] Storage policies match trip membership and visibility rules.
- [x] Upload paths cannot escape the intended trip/user folder structure.
- [x] Database constraints prevent invalid dates, duplicate memberships, and duplicate reactions.
- [ ] Deleting users/trips/media does not silently leave sensitive public data.
- [x] Server/client environment variables are correctly separated.

### Verification before release

- [x] ESLint passes.
- [x] TypeScript and production build pass.
- [x] Supabase security advisors have no findings; performance advisors only report expected unused indexes on an empty database.
- [ ] Public viewer flow passes on desktop and mobile.
- [ ] Owner create/edit/upload/check-in flow passes on desktop and mobile.
- [ ] Contributor invite/upload/comment/react flow passes on desktop and mobile.
- [ ] Signed-out attempts at protected actions behave correctly.
- [ ] Direct URL, refresh, back, and forward behavior pass for core routes.
- [ ] Slow network and failed request behavior is usable for core mutations.
- [x] No browser console errors or Next.js error overlays in the verified auth/trip flows.
- [ ] No unintended horizontal overflow at supported mobile widths.
- [ ] Vercel preview deployment passes the same core-flow verification.

## Removed or deferred scope

Anything removed or postponed must be recorded here with a reason and must also be removed from the visible interface if presenting it would imply functionality.

- None yet.

## Release sign-off

- [ ] Every applicable item above is `[x]` or documented as `N/A` with a reason.
- [ ] No visible interactive control is absent from this inventory.
- [ ] Final end-to-end browser verification completed against the production deployment.
