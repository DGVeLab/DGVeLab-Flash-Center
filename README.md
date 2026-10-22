# DGVeLab Flash Center

Browser-based ESP firmware installer: https://dgvelab.github.io/DGVeLab-Flash-Center/

## Public official firmware

**Only JoyDeck 1** is currently available in the Official Firmware catalog.
JoyDeck 2 and SENTRA Home are not yet public and are not listed.
Wireless Taxi is a work-related project and is deliberately excluded.

**Advanced Flasher** remains available for users who provide their *own* local
BIN/DGV files. It is not a distribution channel for DGVeLab's non-public firmware.

## JoyDeck 1 release synchronization

The source of truth is [DGVeLab/JoyDeck releases](https://github.com/DGVeLab/JoyDeck/releases).
Tags contain both Hub and firmware versions, e.g. `SW1.1.91-FW1.1.12`.

The action `Sync JoyDeck 1 releases` imports published firmware (BIN, DGV,
or RAR containing one merged image), validates the classic ESP32 merged
layout and SHA-256, and stores a versioned BIN under
`firmware/joydeck1/<firmware-version>/firmware-merged.bin`.

To synchronize: **Actions → Sync JoyDeck 1 releases → Run workflow** on `main`.
The workflow runs manually until automatic release checking is enabled.
It updates `firmware/catalog.json`, preserving the paired JoyDeck Hub version
and a link to the original release.

## Requirements and safety

Use Chrome or Edge desktop with Web Serial and a USB data cable.
Close applications using the COM port before flashing; after a successful
write the browser requests a hardware reset and releases its serial port.
A successful flash does **not** independently verify firmware startup.
Flash operations can overwrite settings, calibration and other stored data.
Test unverified hardware/firmware combinations on a spare board first.
Firmware checksums establish file consistency with the published catalog,
not a separate cryptographic publisher signature.

CP210x and CH340/CH9102 driver links are available on the site.
