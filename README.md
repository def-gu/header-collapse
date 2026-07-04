# Header Controls Collapse

[English](README.md) | [Русский](README.ru.md)

A [Foundry VTT](https://foundryvtt.com/) module that collapses actor and item sheet header buttons into a ≡ drop-down menu. The close button always stays visible.

## Why

Every active module adds its own button to the sheet header. With many modules the row overflows the title bar and pushes the close button past the window edge. This module tucks all buttons except the close one into a compact hamburger menu.

## Features

- All header buttons except the close one move into a ≡ menu.
- Every button keeps working exactly as before.
- Buttons that modules add after the sheet opens are picked up too.
- A client setting controls how many buttons it takes to start collapsing.

## Compatibility

- Foundry VTT v12–v13.
- Works with ApplicationV1 sheets, including all pf2e and CoC7 sheets.

## Installation

Until the module is published in the Foundry catalog, install it manually:

1. In Foundry open **Add-on Modules → Install Module**.
2. Paste into the **Manifest URL** field:
   ```
   https://github.com/def-gu/header-collapse/releases/latest/download/module.json
   ```
3. Click **Install** and enable the module in your world settings.

Alternatively, unpack the release archive into `Data/modules/header-collapse`.

## License

[MIT](LICENSE)
