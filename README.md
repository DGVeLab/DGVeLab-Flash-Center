![DGVeLab Flash Center banner](assets/dgvelab-flash-center-banner.png)

# DGVeLab Flash Center


**Flash ESP firmware directly from your browser.**

DGVeLab Flash Center is a web-based tool for installing official DGVeLab firmware or flashing your own firmware files to compatible ESP devices. No dedicated desktop flashing application is required.

**[Open DGVeLab Flash Center](https://dgvelab.github.io/DGVeLab-Flash-Center/)**

## Features

- **DGVeLab Projects** — Choose a project and firmware version from the available catalog, then install it through USB.
- **Advanced Flasher** — Flash local `.bin` or `.dgv` files, with configurable memory offsets and flash settings.
- **Device detection** — Identify the connected ESP chip before programming.
- **Integrity checks** — Validate official firmware downloads against their published SHA-256 checksums.
- **Progress and status** — Follow the flashing process and review the completion summary.
- **USB port release** — After a successful flash, the tool attempts to reset the device and releases the serial port for other applications.

## Requirements

- A computer running **Google Chrome** or **Microsoft Edge** with Web Serial support.
- A compatible **ESP32 or ESP8266** device.
- A **USB data cable** (not a charging-only cable).
- The appropriate USB-to-serial driver, if required by your board.

> **Before connecting:** Close any serial monitor, IDE, or other application using the device's COM/serial port.

## Install official firmware

1. Open the **[Flash Center](https://dgvelab.github.io/DGVeLab-Flash-Center/)**.
2. Select **DGVeLab Projects**.
3. Choose your project and the firmware version you want to install.
4. Connect the device to your computer with a USB data cable.
5. Click **Connect USB**, then select the correct serial port in your browser.
6. Check the detected device and firmware details.
7. Click **Install Firmware** and confirm the operation.
8. Keep the USB cable connected until the completion message appears.

The tool checks the firmware checksum and chip family before programming. After a successful write, it requests a device reset and releases the USB serial connection.

**Important:** A completed flash confirms that the write operation finished; it does not independently verify that the installed application starts correctly.

## Advanced Flasher

Use **Advanced Flasher** when you need to program a local firmware file.

1. Select the **Advanced Flasher** tab.
2. Connect the ESP device using **Connect USB**.
3. Choose one or more `.bin` or `.dgv` firmware images.
4. Set the correct flash offset for every image. **Suggest offsets** can help with common classic ESP32 layouts; always verify the addresses.
5. Optionally select **Merge BIN** to download a merged image from two or more firmware files. Empty gaps are filled with `0xFF`; merging does not flash the device.
6. Review **Flash settings**, if required for your device.
7. Click **Flash Firmware**, confirm and keep USB connected until completion.

The advanced tools also provide **Read chip info** (chip description, factory MAC address, flash ID and flash size where supported), **Reset**, **Erase Flash**, and a collapsible **activity log**. Chip information requires a USB connection; merging files does not.

Factory MAC reading through **Read chip info** remains an Advanced Flasher diagnostic. Runtime **Read / Write** ESP-NOW peer configuration belongs to DGVeLab Projects and requires compatible firmware.

### ESP-NOW MAC / peer configuration

In **DGVeLab Projects**, expand **ESP-NOW · Peer MAC** to access the peer configuration stored by compatible DGVeLab firmware using the `EspNowPeerProvisioner` library.

1. Expand the ESP-NOW panel **before clicking Connect USB**. This selects the normal **firmware serial** connection at **115200 baud**, instead of the bootloader/programming connection.
2. Click **Connect USB**, choose the device's port and ensure its normal application firmware is running. **Read** and **Write** become available while this USB connection is active.
3. Click **Read** to send `GETPEER`. If the device replies `PEER AA:BB:CC:DD:EE:FF CH=6 ...`, its saved peer MAC fills the editable box and the channel selector updates. The device may instead reply `PEER NONE`.
4. Edit the MAC and channel as needed, then click **Write**. The page sends `SETPEER AA:BB:CC:DD:EE:FF CH=6` and waits for `OK SAVED VER=n`. Compatible firmware may reboot automatically after saving.
5. Click **Disconnect USB** when finished. To install firmware instead, close the ESP-NOW panel and connect the bootloader using the normal Projects **Connect USB** button.

**Read returns the stored ESP-NOW peer configuration, not the device's factory hardware MAC.** The commands neither replace the factory MAC nor write eFuses. This feature works only if the running application firmware implements `EspNowPeerProvisioner::parseCommand()` for incoming serial lines. A timeout is not proof that a write was not saved.

> **Warning:** Flash offsets depend on the firmware's memory layout. An incorrect offset, incompatible image, or erase operation can prevent the device from booting or permanently remove saved settings. Do not guess the addresses.

## Troubleshooting

**No serial port appears**
- Check that your USB cable supports data transfer.
- Try a different USB port and close applications using the serial connection.
- Install the appropriate CP210x, CH340, or CH9102 driver if needed. The Flash Center includes links to driver manufacturers.
- Confirm that your browser supports Web Serial and that the page is opened over HTTPS.

**The device does not connect**
- Check that the selected port belongs to your ESP device.
- Some boards require holding **BOOT** while entering flashing mode.
- Disconnect and reconnect USB, then try again.

**Firmware was written but the device does not start**
- Confirm that you selected the correct firmware for the hardware.
- If the automatic reset is not supported by your board, press **EN/RST**.
- Check the activity log for errors and review the firmware's installation instructions.

## Safety notes

Flashing may overwrite calibration data, Wi-Fi credentials, preferences, and other information stored on the device. Back up important settings when possible, and test unfamiliar firmware on a spare board.

Use only firmware from sources you trust. Official firmware checksum checks confirm that the downloaded file matches the published catalog; they are not a separate digital signature.

## Project

Developed by **DGVeLab**.

[Flash Center](https://dgvelab.github.io/DGVeLab-Flash-Center/) · [GitHub repository](https://github.com/DGVeLab/DGVeLab-Flash-Center)
