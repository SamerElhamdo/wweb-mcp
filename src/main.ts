import express, { NextFunction, Request, Response } from 'express';
import { createMcpServer, McpConfig } from './mcp-server';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createWhatsAppClient, WhatsAppConfig } from './whatsapp-client';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import logger, { configureForCommandMode } from './logger';
import { requestLogger, errorHandler } from './middleware';
import { routerFactory } from './api';
import { createSessionRouter } from './session-api';
import { SessionManager } from './session-manager';
import { Client } from 'whatsapp-web.js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const isDockerContainer = process.env.DOCKER_CONTAINER === 'true';

function parseCommandLineArgs(): ReturnType<typeof yargs.parseSync> {
  return yargs(hideBin(process.argv))
    .option('mode', {
      alias: 'm',
      description: 'Run mode: mcp or whatsapp-api',
      type: 'string',
      choices: ['mcp', 'whatsapp-api'],
      default: 'mcp',
    })
    .option('mcp-mode', {
      alias: 'c',
      description:
        'MCP connection mode: standalone (direct WhatsApp client) or api (connect to WhatsApp API)',
      type: 'string',
      choices: ['standalone', 'api'],
      default: 'standalone',
    })
    .option('transport', {
      alias: 't',
      description: 'MCP transport mode: sse or command',
      type: 'string',
      choices: ['sse', 'command'],
      default: 'sse',
    })
    .option('sse-port', {
      alias: 'p',
      description: 'Port for SSE server',
      type: 'number',
      default: 3002,
    })
    .option('api-port', {
      description: 'Port for WhatsApp API server',
      type: 'number',
      default: 3001,
    })
    .option('auth-data-path', {
      alias: 'a',
      description: 'Path to store authentication data',
      type: 'string',
      default: '.wwebjs_auth',
    })
    .option('auth-strategy', {
      alias: 's',
      description: 'Authentication strategy: local (folder), json (file), or none',
      type: 'string',
      choices: ['local', 'json', 'none'],
      default: 'local',
    })
    .option('api-base-url', {
      alias: 'b',
      description: 'Base URL for WhatsApp Web REST API when using api mode',
      type: 'string',
      default: 'http://localhost:3001/api',
    })
    .option('api-key', {
      alias: 'k',
      description: 'API key for WhatsApp Web REST API when using api mode',
      type: 'string',
      default: '',
    })
    .option('media-storage-path', {
      description: 'Path to store media files from WhatsApp messages',
      type: 'string',
    })
    .option('log-level', {
      alias: 'l',
      description: 'Log level: error, warn, info, http, debug',
      type: 'string',
      choices: ['error', 'warn', 'info', 'http', 'debug'],
      default: 'info',
    })
    .help()
    .alias('help', 'h')
    .parseSync();
}

function configureLogger(argv: ReturnType<typeof parseCommandLineArgs>): void {
  logger.level = argv['log-level'] as string;

  // Configure logger to use stderr for all levels when in MCP command mode
  if (argv.mode === 'mcp' && argv.transport === 'command') {
    configureForCommandMode();
  }
}

function createConfigurations(argv: ReturnType<typeof parseCommandLineArgs>): {
  whatsAppConfig: WhatsAppConfig;
  mcpConfig: McpConfig;
} {
  const whatsAppConfig: WhatsAppConfig = {
    authDataPath: argv['auth-data-path'] as string,
    authStrategy: argv['auth-strategy'] as 'local' | 'none',
    dockerContainer: isDockerContainer,
    mediaStoragePath: argv['media-storage-path'] as string | undefined,
  };

  const mcpConfig: McpConfig = {
    useApiClient: argv['mcp-mode'] === 'api',
    apiBaseUrl: argv['api-base-url'] as string,
    apiKey: argv['api-key'] as string,
    whatsappConfig: whatsAppConfig,
  };

  return { whatsAppConfig, mcpConfig };
}

async function startMcpSseServer(
  server: ReturnType<typeof createMcpServer>,
  port: number,
  mode: string,
): Promise<void> {
  const app = express();
  app.use(requestLogger);

  let transport: SSEServerTransport;

  app.get('/sse', async (_req, res) => {
    logger.info('Received SSE connection');
    transport = new SSEServerTransport('/message', res);
    await server.connect(transport);
  });

  app.post('/message', async (req, res) => {
    await transport?.handlePostMessage(req, res);
  });

  app.use(errorHandler);

  app.listen(port, () => {
    logger.info(`MCP server is running on port ${port} in ${mode} mode`);
  });
}

async function startMcpCommandServer(
  server: ReturnType<typeof createMcpServer>,
  mode: string,
): Promise<void> {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    logger.info(`WhatsApp MCP server started successfully in ${mode} mode`);

    process.stdin.on('close', () => {
      logger.info('WhatsApp MCP Server closed');
      server.close();
    });
  } catch (error) {
    logger.error('Error connecting to MCP server', error);
  }
}

async function getWhatsAppApiKey(whatsAppConfig: WhatsAppConfig): Promise<string> {
  if (whatsAppConfig.authStrategy === 'none') {
    return crypto.randomBytes(32).toString('hex');
  }
  const authDataPath = whatsAppConfig.authDataPath;
  if (!authDataPath) {
    throw new Error('The auth-data-path is required when using whatsapp-api mode');
  }
  const apiKeyPath = path.join(authDataPath, 'api_key.txt');
  if (!fs.existsSync(apiKeyPath)) {
    const apiKey = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(apiKeyPath, apiKey);
    return apiKey;
  }
  return fs.readFileSync(apiKeyPath, 'utf8');
}

async function startWhatsAppApiServer(
  whatsAppConfig: WhatsAppConfig,
  port: number,
  enableSessions: boolean = false,
  mongoUri: string = '',
): Promise<void> {
  const app = express();
  app.use(requestLogger);
  app.use(express.json());
  
  // Serve static files for web UI
  const publicPath = path.join(process.cwd(), 'public');
  if (fs.existsSync(publicPath)) {
    app.use(express.static(publicPath));
    logger.info(`Serving static files from: ${publicPath}`);
  } else {
    logger.warn(`Public directory not found at: ${publicPath}`);
  }
  
  // Root route to serve index.html
  app.get('/', (_req: Request, res: Response) => {
    const indexPath = path.join(publicPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).json({ error: 'Web UI not available' });
    }
  });

  let sessionManager: SessionManager | null = null;
  let defaultClient: Client | null = null;

  if (enableSessions && mongoUri) {
    // Multi-session mode with MongoDB
    logger.info('Starting WhatsApp Web REST API with multi-session support...');
    sessionManager = new SessionManager(mongoUri);
    await sessionManager.initialize();

    const apiKey = await getWhatsAppApiKey(whatsAppConfig);
    logger.info(`WhatsApp API key: ${apiKey}`);

    // Session management routes (no auth required for web UI)
    app.use('/api/sessions', createSessionRouter(sessionManager));

    // API routes with session selection (require auth)
    app.use('/api', (req: Request, res: Response, next: NextFunction) => {
      // Skip auth for /api/sessions routes
      if (req.path.startsWith('/sessions')) {
        return next();
      }
      
      const authHeader = req.headers['authorization'];
      if (!authHeader || authHeader !== `Bearer ${apiKey}`) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      
      const sessionId = (req.query.sessionId as string) || (req.body.sessionId as string);
      if (sessionId && sessionManager) {
        const client = sessionManager.getSession(sessionId);
        if (client) {
          const router = routerFactory(client);
          router(req, res, next);
          return;
        }
      }
      res.status(404).json({ error: 'Session not found or not specified' });
    });
  } else {
    // Single session mode (legacy)
    logger.info('Starting WhatsApp Web REST API (single session mode)...');
    defaultClient = await createWhatsAppClient(whatsAppConfig);
    await defaultClient.initialize();

    const apiKey = await getWhatsAppApiKey(whatsAppConfig);
    logger.info(`WhatsApp API key: ${apiKey}`);

    app.use((req: Request, res: Response, next: NextFunction) => {
      const authHeader = req.headers['authorization'];
      if (!authHeader || authHeader !== `Bearer ${apiKey}`) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      next();
    });
    app.use('/api', routerFactory(defaultClient));
  }

  app.use(errorHandler);
  app.listen(port, () => {
    logger.info(`WhatsApp Web Client API started successfully on port ${port}`);
    if (enableSessions) {
      logger.info(`Web UI available at http://localhost:${port}`);
    }
  });

  // Keep the process running
  process.on('SIGINT', async () => {
    logger.info('Shutting down WhatsApp Web Client API...');
    if (sessionManager) {
      await sessionManager.shutdown();
    } else if (defaultClient) {
      await defaultClient.destroy();
    }
    process.exit(0);
  });
}

async function startMcpServer(
  mcpConfig: McpConfig,
  transport: string,
  port: number,
  mode: string,
): Promise<void> {
  let client: Client | null = null;
  if (mode === 'standalone') {
    logger.info('Starting WhatsApp Web Client...');
    client = await createWhatsAppClient(mcpConfig.whatsappConfig);
    await client.initialize();
  }

  logger.info(`Starting MCP server in ${mode} mode...`);
  logger.debug('MCP Configuration:', mcpConfig);

  const server = createMcpServer(mcpConfig, client);

  if (transport === 'sse') {
    await startMcpSseServer(server, port, mode);
  } else if (transport === 'command') {
    await startMcpCommandServer(server, mode);
  }
}

async function main(): Promise<void> {
  try {
    const argv = parseCommandLineArgs();
    configureLogger(argv);

    const { whatsAppConfig, mcpConfig } = createConfigurations(argv);

    if (argv.mode === 'mcp') {
      await startMcpServer(
        mcpConfig,
        argv['transport'] as string,
        argv['sse-port'] as number,
        argv['mcp-mode'] as string,
      );
    } else if (argv.mode === 'whatsapp-api') {
      await startWhatsAppApiServer(
        whatsAppConfig,
        argv['api-port'] as number,
        argv['enable-sessions'] as boolean,
        argv['mongo-uri'] as string,
      );
    }
  } catch (error) {
    logger.error('Error starting application:', error);
    process.exit(1);
  }
}

main();
