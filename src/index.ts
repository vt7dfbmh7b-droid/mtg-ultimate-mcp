import { createServer, type IncomingMessage } from 'node:http';
import { toNodeHandler } from '@modelcontextprotocol/node';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { config } from './config.js';
import { createMtgServer } from './server.js';

const mcpHandler = createMcpHandler(() => createMtgServer());
const handleMcp = toNodeHandler(mcpHandler);

type McpIncomingMessage = IncomingMessage & { method: string; url: string };

const httpServer = createServer((request, response) => {
  void (async () => {
    try {
      const requestUrl = request.url ?? '/';
      const url = new URL(requestUrl, `http://${request.headers.host ?? 'localhost'}`);

      if (url.pathname === '/health') {
        response.statusCode = 200;
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        response.end(
          JSON.stringify({
            ok: true,
            service: 'mtg-ultimate-mcp',
            version: '0.1.0',
            mcpEndpoint: '/mcp',
          }),
        );
        return;
      }

      if (url.pathname === '/mcp' || url.pathname === '/mcp/') {
        if (!request.method || !request.url) {
          response.statusCode = 400;
          response.setHeader('Content-Type', 'application/json; charset=utf-8');
          response.end(JSON.stringify({ error: 'HTTP method and URL are required' }));
          return;
        }
        await handleMcp(request as McpIncomingMessage, response);
        return;
      }

      if (url.pathname === '/') {
        response.statusCode = 200;
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        response.end(
          JSON.stringify({
            name: 'MTG Ultimate MCP',
            version: '0.1.0',
            endpoints: { health: '/health', mcp: '/mcp' },
          }),
        );
        return;
      }

      response.statusCode = 404;
      response.setHeader('Content-Type', 'application/json; charset=utf-8');
      response.end(JSON.stringify({ error: 'Not found' }));
    } catch (error) {
      if (!response.headersSent) {
        response.statusCode = 500;
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
      }
      response.end(
        JSON.stringify({
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  })();
});

httpServer.listen(config.port, '0.0.0.0', () => {
  console.error(`MTG Ultimate MCP listening on port ${config.port}`);
  console.error(`MCP endpoint: http://0.0.0.0:${config.port}/mcp`);
});

const shutdown = async (signal: string): Promise<void> => {
  console.error(`Received ${signal}; shutting down.`);
  httpServer.close();
  await mcpHandler.close();
};

process.once('SIGTERM', () => void shutdown('SIGTERM'));
process.once('SIGINT', () => void shutdown('SIGINT'));
