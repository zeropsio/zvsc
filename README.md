# ⚡️ zVSC

![Frame 330](https://github.com/user-attachments/assets/f03e0f74-8cda-4e39-9932-d23939a340a6)


A Visual Studio Code extension for interacting with Zerops.

## Features

- Push changes to a Service
- Create a new project on Zerops
- Create a new service on Zerops
- Delete a project on Zerops
- Initialize zerops.yml file
- **Push to Zerops Services**: Easily push your code to Zerops services with a simple interface
- **VPN Connection**: Connect to your Zerops projects via WireGuard VPN directly from VS Code

## Technical Details

This extension uses the official Zerops API SDK to interact with the Zerops platform, ensuring reliable and type-safe operations.

## Commands

Commands accesible from the Command Palette (`Ctrl` + `Shift` + `P`).

- `zvsc:push`: Push changes to a Service
- `zvsc:create-project`: Create a new project on Zerops
- `zvsc:create-service`: Create a new service on Zerops
- `zvsc:delete-project`: Delete a project on Zerops
- `zvsc:init-project`: Initialize zerops.yml file

## 🔑 Zerops Token Generation

A personal access token is required to authenticate yourself from vs code. This token has admin privileges, so handle it with care.

1. Navigate to [Settings > Access Token Management](https://app.zerops.io/settings/access-token-management) in the Zerops application.
2. Generate a new access token.
3. Copy the token and paste it into the extension settings.

## Setting up Seamless VPN Connection

When using the VPN feature for the first time, you'll be prompted for your password because WireGuard requires admin privileges. For a more seamless experience, you can set up passwordless sudo for the specific VPN commands:

### macOS/Linux

1. Edit the sudoers file:
   ```bash
   sudo visudo
   ```

2. Add the following line at the end (replace `YOUR_USERNAME` with your actual username):

   **For macOS with Homebrew:**
   ```
   YOUR_USERNAME ALL=(ALL) NOPASSWD: /opt/homebrew/bin/wg-quick, /opt/homebrew/bin/zcli vpn *
   ```

   **For Linux/macOS (standard paths):**
   ```
   YOUR_USERNAME ALL=(ALL) NOPASSWD: /usr/bin/wg-quick, /usr/local/bin/zcli vpn *
   ```

3. Save and exit the editor (in vi/vim, press ESC, then type `:wq` and press Enter)

This configuration allows the specific VPN commands to run with sudo without requiring a password each time.

## Usage

### Push Changes

1. Enter the Service ID
2. Choose whether to include the .git folder 
3. Click "Push Changes"

### VPN Connection

1. Select "Connect VPN" from the dropdown
2. Enter your Project ID
3. Choose whether to auto-disconnect existing connections
4. Click "Connect VPN"

To disconnect, simply select "Disconnect VPN" from the dropdown and click the button.

## Requirements

- [Zerops CLI (zcli)](https://docs.zerops.io/references/zcli) installed
- WireGuard installed for VPN connectivity

## Extension Settings

- None currently

## Known Issues

- None currently

## Release Notes

### 1.0.0

- Initial release
