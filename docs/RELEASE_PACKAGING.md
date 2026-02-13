# Desktop Release Packaging Guide (Local, Reproducible)

This guide defines reproducible local packaging commands for both desktop variants:

- **full** → `World Monitor`
- **tech** → `Tech Monitor`

The Tech variant is configured via `src-tauri/tauri.tech.conf.json` with a distinct product name and binary identifier.

## Prerequisites

- Node.js + npm
- Rust toolchain
- Tauri CLI dependencies for your OS (Xcode tools on macOS, Visual Studio Build Tools + WiX/NSIS support on Windows)

Install dependencies:

```bash
npm ci
```

## macOS packaging (`.app` + `.dmg`)

### Full variant

```bash
npm run desktop:package:macos:full
```

### Tech variant

```bash
npm run desktop:package:macos:tech
```

These commands call Tauri with `--bundles app,dmg` to ensure deterministic macOS artifacts.

### Optional macOS signing + notarization hooks (env)

When signing/notarizing, set these environment variables before running the macOS packaging command:

```bash
export TAURI_BUNDLE_MACOS_SIGNING_IDENTITY="Developer ID Application: Your Company (TEAMID)"
export TAURI_BUNDLE_MACOS_PROVIDER_SHORT_NAME="TEAMID"
export APPLE_ID="you@example.com"
export APPLE_PASSWORD="app-specific-password"
export APPLE_TEAM_ID="TEAMID"
```

Then run:

```bash
npm run desktop:package:macos:full
```

> If the signing/notary variables are not present, packaging still works unsigned.

## Windows packaging (`.exe` + `.msi`)

### Full variant

```bash
npm run desktop:package:windows:full
```

### Tech variant

```bash
npm run desktop:package:windows:tech
```

These commands call Tauri with `--bundles nsis,msi` to produce:

- NSIS installer (`.exe`)
- MSI installer (`.msi`)

### Optional Windows Authenticode hooks (env)

Set Authenticode-related variables before running Windows packaging:

```powershell
$env:TAURI_BUNDLE_WINDOWS_CERTIFICATE_THUMBPRINT="<CERT_THUMBPRINT>"
$env:TAURI_BUNDLE_WINDOWS_TIMESTAMP_URL="http://timestamp.digicert.com"
```

Then run:

```powershell
npm run desktop:package:windows:full
```

> If certificate variables are not present, packaging still works unsigned.

## Variant-aware outputs

- **full** variant uses `src-tauri/tauri.conf.json` (`World Monitor`, `world-monitor`)
- **tech** variant uses `src-tauri/tauri.tech.conf.json` (`Tech Monitor`, `tech-monitor`)

If you want distinct icons per variant, add icon sets and set `bundle.icon` per config file.

## Artifact output locations

Artifacts are generated under:

```text
src-tauri/target/release/bundle/
```

Typical subfolders:

- `app/` (macOS `.app`)
- `dmg/` (macOS `.dmg`)
- `nsis/` (Windows `.exe` installer)
- `msi/` (Windows `.msi` installer)

## Release checklist (clean-machine validation)

1. Build target artifacts for required OS + variant.
2. Copy installer/image to a clean machine (or fresh VM).
3. Install/open app:
   - macOS: open `.dmg`, drag app, launch from Applications.
   - Windows: run `.exe` or `.msi`, then launch from Start menu.
4. Validate startup:
   - Window opens successfully.
   - Map view renders.
   - No crash on first launch.
5. Validate variant identity:
   - App title/product name matches expected variant.
6. If signing was enabled:
   - Confirm signature details in OS security dialogs.
   - Confirm notarization acceptance on macOS (no Gatekeeper warning after notarized release).
