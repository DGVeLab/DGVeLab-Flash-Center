# DGVeLab Flash Center

Web-based ESP firmware installer at https://dgvelab.github.io/DGVeLab-Flash-Center/

## Modes

- **Official Firmware:** catalog-driven, validated firmware images. Availability is intentionally disabled until a release is published with a tested firmware image.
- **Advanced Flasher:** local .bin / .dgv images with user-specified flash addresses. Tested on a classic ESP32 with JoyDeck 1.1.12 merged firmware.

Use a Chromium desktop browser supporting Web Serial (Chrome or Edge). Close any program holding the serial port.

## Add an official firmware release

1. Verify the exact device, flash layout and image using a spare device.
2. Upload the firmware image into `firmware/<project-id>/` (do not point to arbitrary external URLs).
3. Compute the SHA-256 digest of the **exact** uploaded binary. On Windows PowerShell:
   `Get-FileHash .\firmware-merged.bin -Algorithm SHA256`
4. Edit `firmware/catalog.json` in the matching project and add a release entry. Set `published` to `true` **only after hardware validation**.

Example release data (do not publish without a real image and verified hash):

```json
{
  "version": "1.0.0",
  "channel": "stable",
  "published": false,
  "parts": [
    {
      "path": "./firmware/joydeck2/firmware-merged.bin",
      "offset": 0,
      "sha256": "REPLACE_WITH_REAL_64_CHARACTER_SHA256"
    }
  ]
}
```

Use `offset` as a decimal number; the example uses decimal zero. For separate images, supply multiple entries with their *real* offsets. Official mode checks the connected chip family and every SHA-256 hash before requesting confirmation and writing flash. Chip checks are not a guarantee of board compatibility: only publish tested board/firmware combinations.

## Safety and limitations

- JoyDeck 2 firmware 1.3.0 is published for ESP32-classic boards. The official installer has not yet been hardware-tested end-to-end; validate on a spare board before distributing broadly.
- Flashing may overwrite NVS, Wi-Fi credentials, calibration and other user settings.
- A successful write does not prove normal application boot; test reboot on hardware.
- Firmware integrity is checked against the GitHub-hosted catalog; it is not a cryptographic publisher signature.
- This is a beta tool. Use a spare board first.

## Beta v0.4 — post-flash behavior

After a successful write, the browser requests an RTS-based hardware reset. Some boards may require EN/RST manually. The completion panel reports bytes and elapsed time, but does **not** claim that the application booted or independently verified flash readback. USB disconnection events are reported and require reconnection before programming again. A collapsible USB driver guide links to the Silicon Labs CP210x and WCH CH340/CH9102 manufacturer pages.
