# AIO Server MCP

Model Context Protocol (MCP) server for interacting with All-In-One (AIO) Test Management for Jira. This server provides tools for working with test cases through the MCP protocol.

## Requirements

- Node.js >= 18

## Installation

### Manual Installation
```bash
npm install
```

## Build

```bash
npm run build
```

## Features

The server provides the following tools for working with AIO Test Management:

### `get_aio_testcase`

Retrieves test case data from AIO.

Parameters:
- `projectKey`: Project key in AIO (e.g., AT)
- `testCaseKey`: Test case key (e.g., AT-TC-9)

## Dependencies

- `@modelcontextprotocol/sdk` - SDK for MCP protocol implementation
- `axios` - HTTP client for API requests

## Configuration

The server requires configuration in the VSCode MCP settings file (`mcp.json`). Configuration example:

```json
{
  "mcpServers": {
    "aio-server-mcp": {
      "command": "node",
      "args": ["/path/to/aio-server-mcp/build/index.js"],
      "env": {
        "aioUrl": "https://your-jira-instance:port",
        "aioToken": "your-base64-encoded-token"
      }
    }
  }
}
```

### Environment Variables

- `aioUrl` (required): Your Jira server URL
- `aioToken` (required): Base64 encoded access token in `username:password` format