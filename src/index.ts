#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

class AioServer {
  private readonly server: Server;
  private readonly config: {
    aioUrl?: string;
    aioToken?: string;
  };

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

    if (!this.config.aioUrl || !this.config.aioToken) {
      throw new Error('AIO_URL and AIO_TOKEN are required in mcp.json or env');
    }

    this.setupToolHandlers();
  }

  private loadConfig() {
    const homeConfigPath = path.join(process.env.HOME || process.env.USERPROFILE || '', '.cursor', 'mcp.json');
    const localConfigPath = path.resolve('mcp.json');

    let config: { "jira-aio"?: { env?: { AIO_URL?: string, AIO_TOKEN?: string } } } = {};

    try {
      const configToLoad = fs.existsSync(localConfigPath) ? localConfigPath : homeConfigPath;
      const raw = fs.readFileSync(configToLoad, 'utf-8');
      config = JSON.parse(raw);
      console.log(`[AIO] Загружен конфиг из: ${configToLoad}`);
    } catch (error) {
      console.warn('[AIO] Не удалось загрузить mcp.json:', error);
    }

    // Приводим переменные к строковому типу
    return {
      aioUrl: String(config?.['jira-aio']?.env?.AIO_URL || process.env.AIO_URL),
      aioToken: String(config?.['jira-aio']?.env?.AIO_TOKEN || process.env.AIO_TOKEN),
    };
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'get_aio_testcase',
          description: 'Получить данные по тест-кейсу из AIO',
          inputSchema: {
            type: 'object',
            properties: {
              projectKey: { type: 'string', description: 'Ключ проекта в AIO (например, AT)' },
              testCaseKey: { type: 'string', description: 'Ключ тест-кейса (например, AT-TC-9)' }
            },
            required: ['projectKey', 'testCaseKey']
          }
        }
      ]
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const args = request.params.arguments ?? {};
        switch (request.params.name) {
          case 'get_aio_testcase':
            return await this.getAioTestCase(args.projectKey as string, args.testCaseKey as string);
          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
        }
      } catch (error) {
        console.error('[AIO] Ошибка при обработке:', error);
        if (axios.isAxiosError(error)) {
          throw new McpError(
            ErrorCode.InternalError,
            `AIO API error: ${error.response?.data?.message ?? error.message}`
          );
        }
        throw new McpError(ErrorCode.InternalError, `Unexpected error: ${error}`);
      }
    });
  }

  private async getAioTestCase(projectKey: string, testCaseKey: string) {
    const { aioUrl, aioToken } = this.config;

    const url = `${aioUrl}/rest/aio-tcms-api/1.0/project/${projectKey}/testcase/${testCaseKey}/detail`;

    try {
      console.log(`[AIO] Запрос: ${url}`);
      const response = await axios.get(url, {
        headers: {
          'accept': 'application/json;charset=utf-8',
          'Authorization': `Basic ${aioToken}`
        }
      });

      return {
        content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }]
      };
    } catch (error) {
      console.error('[AIO] Ошибка запроса:', error);
      throw error;
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.log('AIO MCP сервер запущен');
  }
}

const server = new AioServer();
server.run().catch((error) => {
  console.error('Ошибка при запуске сервера:', error);
  process.exit(1);
});
