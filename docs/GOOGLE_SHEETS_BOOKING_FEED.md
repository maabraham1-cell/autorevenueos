# Google Sheets as a booking confirmation source

Use Google Sheets as the source of truth for confirmed bookings and send each row (or new rows) into AutoRevenueOS so they flow through `recordConfirmedBooking()` → `confirmed_bookings` and Stripe metering.

## Endpoints

- **Preferred (Sheets-specific):** `POST /api/webhooks/google-sheets?business_id=<BUSINESS_UUID>`
- **Alternative (generic feed):** `POST /api/webhooks/feed` with body including `confirmation_source: "google_sheets"`

If `INBOUND_FEED_SECRET` is set in the environment, send `Authorization: Bearer <INBOUND_FEED_SECRET>`.

## Row → payload mapping

Map your sheet columns to this payload. All confirmations use the same internal model:

| Sheet column (example) | Payload field | Description |
|------------------------|---------------|-------------|
| Business UUID | `business_id` | Required. Your business id in AutoRevenueOS. |
| Booking ID | `external_booking_id` | Optional. Unique id for idempotency (e.g. row id, or `sheet:Sheet1!A2`). |
| Contact UUID | `contact_id` | Optional. If you have it. |
| Recovery UUID | `recovery_id` | Optional. If you have it. |
| Email | `email` | Optional. We resolve `contact_id` and `recovery_id` from this for the business. |
| Confirmed at | `confirmed_at` | Optional. ISO 8601 date (e.g. `2025-03-14T10:00:00Z`). |
| (fixed) | `confirmation_source` | Set to `google_sheets` by the google-sheets endpoint; omit when using that endpoint. |

For **google-sheets** endpoint you do **not** send `confirmation_source` (it is fixed). For **feed** endpoint you must send `confirmation_source: "google_sheets"`.

## Example JSON body (for Google Sheets endpoint)

```json
{
  "business_id": "550e8400-e29b-41d4-a716-446655440000",
  "external_booking_id": "sheet:Confirmed!A5",
  "email": "client@example.com",
  "confirmed_at": "2025-03-14T14:30:00Z"
}
```

Or with `business_id` in the URL:

```
POST /api/webhooks/google-sheets?business_id=550e8400-e29b-41d4-a716-446655440000
Content-Type: application/json

{
  "external_booking_id": "row-42",
  "email": "client@example.com",
  "confirmed_at": "2025-03-14T14:30:00Z"
}
```

## Google Apps Script bridge

When you want to post from a Google Sheet (e.g. on form submit or when a row is marked “Confirmed”):

1. In your Sheet, open **Extensions → Apps Script**.
2. Set your AutoRevenueOS base URL and optional secret (e.g. in Script Properties: `AUTOREVENUEOS_URL`, `AUTOREVENUEOS_FEED_SECRET`).
3. Use a function like below to send one row to the google-sheets webhook.

```javascript
function sendConfirmedBookingToAutoRevenueOS() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var row = sheet.getActiveCell().getRow();
  var data = sheet.getRange(row, 1, row, 6).getValues()[0]; // adjust columns to your layout

  var businessId = data[0];   // column A
  var externalBookingId = data[1]; // column B (e.g. row id or booking ref)
  var email = data[2];        // column C
  var confirmedAt = data[3];  // column D (ISO string or leave empty for now)

  var url = PropertiesService.getScriptProperties().getProperty('AUTOREVENUEOS_URL') + '/api/webhooks/google-sheets';
  var payload = {
    business_id: businessId,
    external_booking_id: externalBookingId || ('sheet:A' + row),
    email: email || null,
    confirmed_at: confirmedAt || new Date().toISOString()
  };

  var options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  var secret = PropertiesService.getScriptProperties().getProperty('AUTOREVENUEOS_FEED_SECRET');
  if (secret) {
    options.headers = { 'Authorization': 'Bearer ' + secret };
  }

  var response = UrlFetchApp.fetch(url, options);
  var code = response.getResponseCode();
  if (code >= 200 && code < 300) {
    Logger.log('Booking sent: ' + response.getContentText());
  } else {
    Logger.log('Error ' + code + ': ' + response.getContentText());
  }
}
```

4. Trigger: bind `sendConfirmedBookingToAutoRevenueOS` to a button, or use a trigger (e.g. on edit of a “Status” column when it becomes “Confirmed”).

## Make / Zapier / Pipedream

- **Make:** HTTP module → POST to `https://your-app/api/webhooks/google-sheets?business_id={{business_id}}`, body: map your scenario fields to `external_booking_id`, `email`, `confirmed_at`.
- **Zapier:** “Webhooks by Zapier” → POST to the same URL with the same body shape.
- **Pipedream:** HTTP request step to `/api/webhooks/google-sheets` or `/api/webhooks/feed` with `confirmation_source: "google_sheets"`.

All paths end up in `recordConfirmedBooking()` with `confirmation_source: "google_sheets"`, so billing and attribution stay consistent.
