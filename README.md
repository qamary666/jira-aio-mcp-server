# AIO MCP Server

A Model Context Protocol (MCP) server for interacting with Jira AIO (All-in-One) Test Case Management System.

## Features

- Get test case details from AIO
- Search test cases by project and/or folders
- Get folder structure of a project
- Get list of all projects in AIO

## Prerequisites

- Node.js
- Access to a Jira instance with AIO Test Case Management System
- Jira API token

## Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
```
3. Build the project:
```bash
npm run build
```

## Configuration

The server requires configuration through `mcp.json`. You can place this file either:
- In your home directory: `~/.cursor/mcp.json`
- In the project root directory

Example `mcp.json` configuration:

```json
{
  "jira-aio": {
    "command": "node",
    "args": ["/path/to/aio-server-mcp/build/index.js"],
    "env": {
      "JIRA_URL": "https://your-jira-instance:port",
      "JIRA_TOKEN": "your-base64-encoded-token"
    }
  }
}
```

### Configuration Parameters

- `JIRA_URL`: The URL of your Jira instance (including port if necessary)
- `JIRA_TOKEN`: Your Jira API token for authentication

## Available Tools

### 1. get_aio_testcase
Get detailed information about a specific test case.
- Parameters:
  - `projectKey`: Project key in AIO (e.g., "AT")
  - `testCaseKey`: Test case key (e.g., "AT-TC-9")

### 2. search_aio_testcase
Search for test cases within a project and specific folders.
- Parameters:
  - `projectId`: Project ID in AIO (e.g., 11502)
  - `folderIds`: (Optional) Array of folder IDs to search within

### 3. get_aio_folders
Retrieve the folder structure of a project.
- Parameters:
  - `projectId`: Project ID in AIO (e.g., 11502)

### 4. get_aio_projects
Get a list of all available projects in AIO.
- No parameters required

## Error Handling

The server includes comprehensive error handling for:
- API request failures
- Authentication issues
- Invalid configurations
- Missing required parameters

## Security

- The server uses bearer token authentication
- HTTPS connections are supported
- Sensitive configuration can be provided through environment variables

## Development

The server is built using:
- TypeScript
- Model Context Protocol SDK
- Axios for HTTP requests
