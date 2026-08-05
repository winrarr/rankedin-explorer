# Rankedin Explorer

Rankedin Explorer is a personal, read-only GitHub Pages tool for exploring the context behind Rankedin tournament results. It is designed to answer questions such as:

- Who is actually in a tournament class?
- What classes and levels have these players entered recently?
- How far did they get, who did they play and what were the scores?
- How does the current field compare by historical skill rating?

The first version supports two temporary analysis modes: tournament field exploration with class switching, player filtering and pair history; and single-player progress with a level/class placement timeline and source-linked results. It uses Rankedin's public API directly from the browser and does not require an account, backend or database.

## Run locally

```bash
npm install
npm run dev
```

Useful checks:

```bash
npm run check
```

The API contract and the current read paths are summarized in [`docs/rankedin-api.md`](./docs/rankedin-api.md), with the [Rankedin Swagger document](https://api.rankedin.com/swagger/v1/swagger.json) as the authoritative schema.

## Data and privacy

Live tournament and player data comes from Rankedin. The app does not save tournament selections, player selections or reports. Only lightweight display preferences such as theme, table density and history depth are stored locally in the browser.

## Deployment

The repository includes a GitHub Actions workflow for GitHub Pages. Enable Pages for the repository and select **GitHub Actions** as the source. The Vite build uses relative asset paths so it works under a project-page URL.

See [`AGENTS.md`](./AGENTS.md) for the canonical project operating guide and [`docs/architecture.md`](./docs/architecture.md) for the current data flow.
