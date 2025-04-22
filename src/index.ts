import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError } from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import https from 'https';

class AioServer {
  server: Server;
  config: { jiraUrl: string };

  constructor() {
    this.server = new Server(
      {
        name: 'aio-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );
    this.config = this.loadConfig();
    if (!this.config.jiraUrl || !process.env.JIRA_TOKEN) {
      throw new Error('JIRA_URL and JIRA_TOKEN are required in mcp.json or env');
    }
    this.setupToolHandlers();
  }

  loadConfig() {
    const homeConfigPath = path.join(process.env.HOME || process.env.USERPROFILE || '', '.cursor', 'mcp.json');
    const localConfigPath = path.resolve('mcp.json');
    let config = {};
    try {
      const configToLoad = fs.existsSync(localConfigPath) ? localConfigPath : homeConfigPath;
      const raw = fs.readFileSync(configToLoad, 'utf-8');
      config = JSON.parse(raw);
      console.error(`[AIO] Config loaded from: ${configToLoad}`);
    } catch (error) {
      console.warn('[AIO] Failed to load mcp.json:', error);
    }
    const c = config as Record<string, any>;
    return {
      jiraUrl: String(c?.['jira-aio']?.env?.JIRA_URL || process.env.JIRA_URL),
    };
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'get_aio_testcase',
          description: 'Get test case details from AIO',
          inputSchema: {
            type: 'object',
            properties: {
              projectKey: { type: 'string', description: 'Ключ проекта в AIO (например, AT)' },
              testCaseKey: { type: 'string', description: 'Ключ тест-кейса (например, AT-TC-9)' },
            },
            required: ['projectKey', 'testCaseKey'],
          },
        },
        {
          name: 'search_aio_testcase',
          description: 'Search test cases by project and/or folders',
          inputSchema: {
            type: 'object',
            properties: {
              projectId: { type: 'number', description: 'ID проекта в AIO (например, 11502)' },
              folderIds: {
                type: 'array',
                description: 'Array of folder IDs to search within (optional)',
                items: { type: 'number' },
              },
            },
            required: ['projectId'],
          },
        },
        {
          name: 'get_aio_folders',
          description: 'Get folder structure of a project',
          inputSchema: {
            type: 'object',
            properties: {
              projectId: { type: 'number', description: 'ID проекта в AIO (например, 11502)' },
            },
            required: ['projectId'],
          },
        },
        {
          name: 'get_aio_projects',
          description: 'Get list of all projects in AIO',
          inputSchema: {
            type: 'object',
            properties: {},
            required: [],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const args = request.params.arguments ?? {};
        switch (request.params.name) {
          case 'get_aio_testcase':
            return await this.handleGetAioTestCase(args.projectKey as string, args.testCaseKey as string);
          case 'search_aio_testcase':
            return await this.handleSearchAioTestCases(Number(args.projectId), args.folderIds as number[]);
          case 'get_aio_folders':
            return await this.handleGetAioFolders(Number(args.projectId));
          case 'get_aio_projects':
            return await this.handleGetAioProjects();
          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
        }
      } catch (error) {
        console.error('[AIO] Error while handling request:', error);
        if (axios.isAxiosError(error)) {
          throw new McpError(ErrorCode.InternalError, `AIO API error: ${error.response?.data?.message ?? error.message}`);
        }
        throw new McpError(ErrorCode.InternalError, `Unexpected error: ${error}`);
      }
    });
  }

  async handleGetAioTestCase(projectKey: string, testCaseKey: string) {
    const url = `${this.config.jiraUrl}/rest/aio-tcms-api/1.0/project/${projectKey}/testcase/${testCaseKey}/detail`;
    try {
      console.log(`[AIO] Запрос: ${url}`);
      const response = await axios.get(url, {
        headers: {
          accept: 'application/json;charset=utf-8',
          Authorization: `Bearer ${process.env.JIRA_TOKEN}`,
        },
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
      };
    } catch (error) {
      console.error('[AIO] Request error:', error);
      throw error;
    }
  }

  async handleGetAioFolders(projectId: number) {
    const url = `${this.config.jiraUrl}/rest/aio-tcms/1.0/project/${projectId}/testcase/folder`;
    try {
      console.log(`[AIO] Получение структуры папок: ${url}`);
      const response = await axios.get(url, {
        headers: {
          'accept': 'application/json',
          'Content-Type': 'application/json;charset=UTF-8',
          'Authorization': `Bearer ${process.env.JIRA_TOKEN}`,
          'X-Requested-With': 'XMLHttpRequest'
        },
        params: {
          c_pId: projectId,
          page: 'overview',
          params: '{}',
          t: Date.now(),
        },
        httpsAgent: new https.Agent({
          rejectUnauthorized: false
        })
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
      };
    } catch (error) {
      console.error('[AIO] Error retrieving folders:', error);
      if (axios.isAxiosError(error)) {
        console.error('[AIO] Error details:', {
          status: error.response?.status,
          data: error.response?.data,
          headers: error.response?.headers
        });
      }
      throw error;
    }
  }

  async handleSearchAioTestCases(projectId: number, folderIds: number[] = []) {
    const url = `${this.config.jiraUrl}/rest/aio-tcms/1.0/project/${projectId}/testcase/paged`;

    const body: any = {
      startAt: 0,
      maxResults: 100,
      columns: ['key', 'title', 'testStatusID', 'ownedByID'],
      sortingData: {
        sortColumn: 'key',
        sortOrder: 'DESC',
      },
    };

    if (folderIds.length > 0) {
      body.folderID = {
        comparisonType: 'IN',
        list: folderIds,
      };
    }

    try {
      console.log(`[AIO] Поиск тест-кейсов: ${url}`);
      const testCasesResponse = await axios.post(url, body, {
        headers: {
          'accept': 'application/json',
          'Content-Type': 'application/json;charset=UTF-8',
          'Authorization': `Bearer ${process.env.JIRA_TOKEN}`,
          'X-Requested-With': 'XMLHttpRequest'
        },
        httpsAgent: new https.Agent({
          rejectUnauthorized: false
        })
      });

      const responseData = testCasesResponse.data?.values ?? testCasesResponse.data;

      if (!responseData) {
        throw new McpError(ErrorCode.InternalError, 'No data in response');
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(responseData, null, 2) }],
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('[AIO] Ошибка запроса:', {
          status: error.response?.status,
          data: error.response?.data,
          headers: error.response?.headers
        });
      } else {
        console.error('[AIO] Unknown error:', error);
      }
      throw error;
    }
  }

  async handleGetAioProjects() {
    const jiraToken = process.env.JIRA_TOKEN;

    if (!jiraToken) {
      throw new Error('JIRA_TOKEN is not set in the environment');
    }

    const url = `${this.config.jiraUrl}/rest/api/latest/project`;

    try {
      console.log(`[AIO] Получение списка проектов из Jira: ${url}`);

      const response = await axios.get(url, {
        headers: {
          'accept': 'application/json',
          'Authorization': `Bearer ${jiraToken}`
        }
      });

      const projects = response.data?.map((p: any) => ({
        id: p.id,
        key: p.key,
        name: p.name
      })) ?? [];

      return {
        content: [{ type: 'text', text: JSON.stringify(projects, null, 2) }],
      };
    } catch (error) {
      console.error('[AIO] Error retrieving projects:', error);
      throw error;
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.log('AIO MCP server started');
  }
}

const server = new AioServer();
server.run().catch((error) => {
  console.error('Server startup error:', error);
  process.exit(1);
});
