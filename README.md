# DGVeLab Flash Center

**Flash ESP firmware directly from your browser.**

DGVeLab Flash Center is a web-based tool for installing official DGVeLab firmware or flashing your own firmware files to compatible ESP devices. No dedicated desktop flashing application is required.

**[Open DGVeLab Flash Center](https://dgvelab.github.io/DGVeLab-Flash-Center/)**

## Features

- **Official Firmware** — Choose a project and firmware version from the available catalog, then install it through USB.
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
2. Select **Official Firmware**.
3. Choose your project and the firmware version you want to install.
4. Connect the device to your computer with a USB data cable.
5. Click **Connect USB**, then select the correct serial port in your browser.
6. Check the detected device and firmware details.
7. Click **Install Official Firmware** and confirm the operation.
8. Keep the USB cable connected until the completion message appears.

The tool checks the firmware checksum and chip family before programming. After a successful write, it requests a device reset and releases the USB serial connection.

**Important:** A completed flash confirms that the write operation finished; it does not independently verify that the installed application starts correctly.

## Advanced Flasher

Use **Advanced Flasher** when you need to program a local firmware file.

1. Select the **Advanced Flasher** tab.
2. Connect the ESP device using **Connect USB**.
3. Choose one or more `.bin` or `.dgv` firmware images.
4. Set the **correct flash offset** for every image.
5. Review the available flash parameters. Keep the original settings unless your firmware instructions specify otherwise.
6. Click **Flash Firmware** and confirm the operation.
7. Wait for the completion message before disconnecting the device.

The advanced tools also provide **Reset Device**, **Erase Entire Flash**, and an **activity log**.

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
