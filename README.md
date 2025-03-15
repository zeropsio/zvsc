# ⚡️ zVSC

A Visual Studio Code extension for interacting with Zerops.

## Features

- Push changes to a Service
- Create a new project on Zerops
- Create a new service on Zerops
- Delete a project on Zerops
- Initialize zerops.yml file

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
