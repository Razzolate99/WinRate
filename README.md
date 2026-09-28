# WinRate

A local Windows desktop app that detects an active League of Legends match and flags players whose most recent games form a loss streak.

## Setup

1. Install Node.js 20 or newer.
2. Run `npm install`.
3. Run `npm run dev`.
4. Create a development API key at [developer.riotgames.com](https://developer.riotgames.com/).
5. Open WinRate settings, paste the key, and select the routing group for your server.
6. Enter a League match and click **Scan live game**.

Riot development keys expire every 24 hours. Replace the key in settings when Riot issues a new one.

## Commands

- `npm run dev` — run Vite and Electron in development mode
- `npm run build` — type-check and build the renderer
- `npm run dist` — create a Windows installer in `release/`
- `npm run lint` — run the linter

## Privacy and data

The API key is encrypted with Electron's `safeStorage` (Windows DPAPI) and saved under the app's user-data directory. It is only sent to Riot API hosts. Live game data comes from Riot's local Live Client Data API at `127.0.0.1:2999`.

WinRate is not endorsed by Riot Games and does not reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties.
# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
