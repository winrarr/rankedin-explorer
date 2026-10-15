# Private analytics

The site can send page visits and successful lookup events to a private GoatCounter dashboard. Analytics are optional and remain disabled until a GoatCounter site code is configured.

## Configure the deployed site

1. Create a GoatCounter site and note its site code. GoatCounter's hosted service is free for reasonable public usage; it also offers a self-hosted option.
2. In the GitHub repository, open **Settings → Secrets and variables → Actions → Variables**.
3. Add a repository variable named `GOATCOUNTER_CODE` with the site code as its value.
4. Deploy `main` again. The Pages workflow passes the variable to Vite as `VITE_GOATCOUNTER_CODE`.

The site code is a public endpoint identifier embedded in the built page, not an API secret. Without a configured site code, no analytics script loads; a mistyped or unregistered code will not produce usable stats. For local builds, set `VITE_GOATCOUNTER_CODE` in an ignored `.env.local` file.

## What is counted

- Site visits use the fixed `/app` path, so tournament, player and league references in the URL are not sent.
- Successful tournament snapshot loads emit `lookup-tournament`.
- Successful player profile loads emit `lookup-player`.
- Successful Lunar League snapshot loads emit `lookup-lunar-league`.
- Failed lookups and pool changes do not count as new lookups.

Lookup events contain only the event name and a generic title. The app never sends player names, Rankedin IDs, tournament IDs, league IDs or search text. Events count successful lookup actions, including repeated lookups, rather than unique records.

GoatCounter reports aggregate statistics without cookies or browser storage. It receives normal web requests and temporarily uses IP address and user-agent information in memory to deduplicate visits; its documentation says those raw values are not stored. Browser privacy tools may block analytics requests, so counts are estimates. See [GoatCounter's privacy details](https://www.goatcounter.com/help/privacy) and [event API](https://www.goatcounter.com/help/events).
