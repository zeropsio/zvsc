<p align="center">
  <img src="resources/banner.png" alt="Zerops Logo">
</p>

<p align="center">
  <b>zVSC: Zerops VS Code Extension for Interacting with Zerops</b>
</p>

<!-- <p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=Zerops.zvsc">
    <img src="https://img.shields.io/visual-studio-marketplace/v/Zerops.zvsc" alt="Visual Studio Marketplace Version">
  </a>
  <a href="https://marketplace.visualstudio.com/items?itemName=Zerops.zvsc">
    <img src="https://img.shields.io/visual-studio-marketplace/d/Zerops.zvsc" alt="Visual Studio Marketplace Downloads">
  </a>
  <a href="https://marketplace.visualstudio.com/items?itemName=Zerops.zvsc">
    <img src="https://img.shields.io/visual-studio-marketplace/r/Zerops.zvsc" alt="Visual Studio Marketplace Rating">
  </a>
  <a href="https://github.com/zeropsio/zvsc/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/zeropsio/zvsc" alt="License">
  </a>
</p> -->

## Features

- **Deploy Applications**: Push your code directly to Zerops services with a single click
- **VPN Connection Management**: Connect to your Zerops VPN directly from VS Code
- **Project Configuration**: Initialize and configure Zerops projects and services
- **Recipe Templates**: Clone and use ready-made project templates
- **Documentation Access**: Access Zerops documentation directly within VS Code
- **Web Interface Integration**: Open the Zerops dashboard, project pages, and service details in your browser

## Installation

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "Zerops"
4. Click Install
5. Reload VS Code when prompted

### Prerequisites

- [Zerops CLI (zcli)](https://docs.zerops.io/references/zcli) - Required for all operations
- [WireGuard](https://www.wireguard.com/install/) - Required for VPN connectivity

## Authentication

### Generate a Personal Access Token

1. Navigate to [Settings > Access Token Management](https://app.zerops.io/settings/access-token-management) in your Zerops account
2. Click "Generate New Token"
3. Set an appropriate name and click "Generate Token"
4. Copy the displayed token (it will be shown only once)

### Login to Zerops from VS Code

1. Open the Command Palette (Ctrl+Shift+P)
2. Type "Zerops: Login" and select it
3. Paste your access token when prompted
   
Alternatively, use the Zerops menu in the status bar by clicking the rocket option.

## Usage

### Status Bar Controls

The extension adds several options to your VS Code status bar:

- **Zerops**: Main menu for all Zerops commands
- **zPush**: Push your code to Zerops
- **zService**: Explore service options
- **zGUI**: Open Zerops dashboard
- **zVpn Up**: Connect to Zerops VPN
- **zVpn Down**: Disconnect from Zerops VPN

### Main Commands

#### Deploying Code

1. Click the "Zerops" option in the status bar
2. Select "Push to Zerops"
3. Select your target service (or configure one if not set up)

#### Accessing Zerops Dashboard

1. Click the "Zerops" option
2. Select "Explore GUI" and then "Open GUI"

#### Using Recipe Templates

1. Click the "Zerops" option
2. Select "Clone Recipe"
3. Choose from available templates

#### Configuration Management

1. Click the "Zerops" option
2. Select "Init Configurations"
3. Choose "Init zerops.yml" or "Init zerops-project-import.yml"

## Project Configuration

To configure your project, set up the service and project IDs:

1. Click the "Zerops" option
2. Select "Settings"
3. Choose "Add Service ID" or "Add Project ID"
4. Enter the IDs from your Zerops dashboard

## Troubleshooting

### VPN Connection Issues

If you're having trouble connecting to the VPN:
1. Ensure WireGuard is installed and running
2. Check that your Project ID is correctly configured
3. Try disconnecting and reconnecting

### Authentication Problems

If you're experiencing login issues:
1. Verify your access token is valid
2. Try logging out and logging back in
3. Regenerate a new token if needed

## Support and Feedback

- **Documentation**: Visit [Zerops Documentation](https://docs.zerops.io)
- **Community**: Join our [Discord server](https://discord.gg/zeropsio) for support
- **Issues**: Report bugs or request features on our [GitHub repository](https://github.com/zeropsio/zvsc/issues)
- **Contact**: Email us at [support@zerops.io](mailto:support@zerops.io)

## License

This extension is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.