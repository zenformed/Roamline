# Upload to Roamline — Apple Shortcut

This Shortcut is Roamline's iPhone-native photo selection path. Roamline passes it a short-lived, single-trip token; the Shortcut never stores a Supabase password or the user's Roamline login.

## Shortcut settings

- Name: `Upload to Roamline`
- Show in Share Sheet: on
- Accepted share-sheet types: Images and Media
- If there is no share-sheet input, use **Select Photos** with **Select Multiple** enabled.

## Actions

1. **Get Text from Shortcut Input** and save it as `Session Token`.
2. If Shortcut Input has images or media, save them as `Selected Media`; otherwise run **Select Photos** with multiple selection enabled.
3. Set `API URL` to `https://cjobbggzalfwtqxzbpob.supabase.co/functions/v1/iphone-upload`.
4. Use **Get Contents of URL** on `API URL`:
   - Method: POST
   - Request Body: JSON
   - `action`: `inspect`
   - `token`: `Session Token`
5. Repeat with each item in `Selected Media`.
6. Inside the repeat, get the file's Name, Media Type, Date Taken, and Location details.
7. Use **Get Contents of URL** on `API URL` with POST JSON:
   - `action`: `ticket`
   - `token`: `Session Token`
   - `filename`: the media name
   - `mimeType`: the media MIME type (use `image/jpeg` when Photos provides no type)
   - `capturedAt`: Date Taken in ISO 8601 format
   - `latitude` and `longitude`: the Location coordinates when present
8. From that response, get `uploadUrl`, `contentType`, and `mediaId`.
9. Use **Get Contents of URL** on `uploadUrl`:
   - Method: PUT
   - Header `Content-Type`: `contentType`
   - Request body: File, using the repeated media item
10. Use **Get Contents of URL** on `API URL` with POST JSON:
    - `action`: `complete`
    - `token`: `Session Token`
    - `mediaId`: the ticket's `mediaId`
11. End repeat.
12. Use **Get Contents of URL** on `API URL` with POST JSON containing `action: finish` and `token: Session Token`.
13. Show notification: `Uploaded [Repeat Count] items to Roamline`.
14. Open the `returnUrl` from the finish response.

## Publishing the install link

Run the Shortcut once on an iPhone, then choose **Share → Copy iCloud Link**. Put that public link in `NEXT_PUBLIC_ROAMLINE_SHORTCUT_URL` in Vercel. This is the only value needed for the one-time setup button; it is not a secret.

Test the Shortcut with two photos before sharing the iCloud link broadly. Apple signs and hosts the installable Shortcut, so this final import/share step must happen on an Apple device.
