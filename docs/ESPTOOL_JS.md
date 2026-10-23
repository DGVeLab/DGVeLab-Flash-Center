# esptool-js dependency maintenance

Flash Center runs a **fixed** Espressif [esptool-js](https://github.com/espressif/esptool-js) browser module, currently **v0.7.0**.

## Runtime

The site loads `./vendor/esptool-js/0.7.0/bundle.js` directly, served from this repository via GitHub Pages. It does not need unpkg to flash devices at runtime.

- `vendor/esptool-js/0.7.0/bundle.js`: the exact upstream distribution bundle.
- `vendor/esptool-js/0.7.0/manifest.json`: recorded SHA-256 and source URL.
- `vendor/esptool-js/0.7.0/LICENSE`: upstream license.
- `flasher.js`: imports the pinned local module.

The vendor import does not change flashing parameters, serial protocol, or chip support. The copied module still needs to be checked against real hardware after deployment.

## Importing the currently pinned version

The `Vendor esptool-js` GitHub Action can be run from **Actions → Vendor esptool-js → Run workflow**. It downloads only v0.7.0 if not already stored, validates the downloaded file, checks JavaScript module syntax, and commits the bundle and local import together. A recorded checksum protects the checked-in bundle from accidental changes. It will not silently replace a recorded bundle with different bytes.

## New release notifications

The `Check esptool-js releases` GitHub Action runs weekly on Mondays or can be run manually. It compares the latest stable upstream GitHub release with the pinned manifest version. If they differ, it creates **one GitHub issue per release** (unless an issue for that release already exists). It never changes the bundled code.

Before upgrading, review release notes and compatibility changes, then test: USB connect/close, chip identity and factory MAC, ESP32/ESP8266 support, official firmware installation, Advanced flashing, progress, reset, and release of the COM port. Upgrade in a controlled commit only after tests pass.

Upstream project: https://github.com/espressif/esptool-js
