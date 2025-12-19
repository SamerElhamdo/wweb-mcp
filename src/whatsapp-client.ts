import { Client, LocalAuth, Message, NoAuth, RemoteAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import logger from './logger';
import fs from 'fs';
import path from 'path';
import axios from 'axios';

// Configuration interface
export interface WhatsAppConfig {
  authDataPath?: string;
  authStrategy?: 'local' | 'json' | 'none';
  dockerContainer?: boolean;
  mediaStoragePath?: string;
}

interface WebhookConfig {
  url: string;
  authToken?: string;
  filters?: {
    allowedNumbers?: string[];
    allowPrivate?: boolean;
    allowGroups?: boolean;
  };
}

function loadWebhookConfig(dataPath: string): WebhookConfig | undefined {
  // First, try to load from environment variables (priority)
  const webhookUrl = process.env.WEBHOOK_URL;
  if (webhookUrl) {
    const config: WebhookConfig = {
      url: webhookUrl,
      authToken: process.env.WEBHOOK_AUTH_TOKEN,
      filters: {
        allowedNumbers: process.env.WEBHOOK_ALLOWED_NUMBERS
          ? process.env.WEBHOOK_ALLOWED_NUMBERS.split(',').map(n => n.trim())
          : undefined,
        allowPrivate: process.env.WEBHOOK_ALLOW_PRIVATE !== 'false',
        allowGroups: process.env.WEBHOOK_ALLOW_GROUPS !== 'false',
      },
    };
    
    // Remove undefined filters
    if (config.filters && !config.filters.allowedNumbers?.length) {
      delete config.filters.allowedNumbers;
    }
    if (config.filters && config.filters.allowPrivate === true && config.filters.allowGroups === true) {
      // Both are true by default, so we can remove them to use defaults
      delete config.filters;
    }
    
    logger.info('Webhook configuration loaded from environment variables');
    return config;
  }

  // Fallback to file-based configuration
  const webhookConfigPath = path.join(dataPath, 'webhook.json');
  if (!fs.existsSync(webhookConfigPath)) {
    return undefined;
  }
  logger.info('Webhook configuration loaded from file');
  return JSON.parse(fs.readFileSync(webhookConfigPath, 'utf8'));
}

export function createWhatsAppClient(config: WhatsAppConfig = {}): Client {
  const authDataPath = config.authDataPath || '.wwebjs_auth';
  const mediaStoragePath = config.mediaStoragePath || path.join(authDataPath, 'media');

  const webhookConfig = loadWebhookConfig(authDataPath);

  // Create media storage directory if it doesn't exist
  if (!fs.existsSync(mediaStoragePath)) {
    try {
      fs.mkdirSync(mediaStoragePath, { recursive: true });
      logger.info(`Created media storage directory: ${mediaStoragePath}`);
    } catch (error) {
      logger.error(`Failed to create media storage directory: ${error}`);
    }
  }

  // Remove Chrome lock files if they exist
  // This prevents "profile in use" errors when restarting
  // LocalAuth creates .wwebjs_auth directory inside dataPath, and Chromium creates Default profile inside
  const removeLockFile = (lockPath: string) => {
    try {
      if (fs.existsSync(lockPath)) {
        fs.rmSync(lockPath, { force: true });
        logger.info(`Removed lock file: ${lockPath}`);
        return true;
      }
    } catch (error) {
      // Ignore errors when removing lock files
      logger.debug(`Could not remove lock file ${lockPath}: ${error}`);
    }
    return false;
  };

  // Recursively find and remove all SingletonLock files
  const removeAllLockFiles = (dirPath: string, maxDepth: number = 5, currentDepth: number = 0): number => {
    let removedCount = 0;
    if (currentDepth >= maxDepth) return removedCount;
    
    try {
      if (!fs.existsSync(dirPath)) return removedCount;
      
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const entryPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          // Check for SingletonLock in this directory
          const lockFile = path.join(entryPath, 'SingletonLock');
          if (removeLockFile(lockFile)) {
            removedCount++;
          }
          // Recursively search subdirectories
          removedCount += removeAllLockFiles(entryPath, maxDepth, currentDepth + 1);
        } else if (entry.name === 'SingletonLock') {
          // Found a lock file directly
          if (removeLockFile(entryPath)) {
            removedCount++;
          }
        }
      }
    } catch (error) {
      // Ignore errors when scanning directories
      logger.debug(`Could not scan directory ${dirPath} for lock files: ${error}`);
    }
    
    return removedCount;
  };

  // Remove lock files from the entire authDataPath tree
  logger.info(`Scanning for lock files in: ${authDataPath}`);
  const removedCount = removeAllLockFiles(authDataPath, 5);
  if (removedCount > 0) {
    logger.info(`Removed ${removedCount} lock file(s) from ${authDataPath}`);
  } else {
    logger.debug('No lock files found to remove');
  }

  const npx_args = { headless: true };
  
  // Support different authentication strategies
  let authStrategy;
  if (config.authStrategy === 'local') {
    // LocalAuth: stores in folder structure (default)
    authStrategy = new LocalAuth({
      dataPath: authDataPath,
    });
  } else if (config.authStrategy === 'json') {
    // RemoteAuth: stores session in JSON file using FileStore
    const sessionPath = path.join(authDataPath, 'session.json');
    
    // Create a simple file-based store for JSON storage
    // RemoteAuth uses session name, but we'll use a single JSON file
    const fileStore = {
      sessionExists: async ({ session: _session }: { session: string }): Promise<boolean> => {
        try {
          return fs.existsSync(sessionPath);
        } catch {
          return false;
        }
      },
      delete: async ({ session: _session }: { session: string }): Promise<void> => {
        try {
          if (fs.existsSync(sessionPath)) {
            fs.unlinkSync(sessionPath);
          }
        } catch (error) {
          logger.error(`Failed to delete session file: ${error}`);
        }
      },
      save: async ({ session: _session }: { session: string }): Promise<void> => {
        try {
          // RemoteAuth will handle the actual session data
          // This is just a placeholder
        } catch (error) {
          logger.error(`Failed to save session file: ${error}`);
        }
      },
      extract: async ({ session: _session, path: extractPath }: { session: string; path: string }): Promise<void> => {
        try {
          if (fs.existsSync(sessionPath)) {
            const sessionData = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
            // Extract session data to the specified path
            fs.writeFileSync(extractPath, JSON.stringify(sessionData, null, 2));
          }
        } catch (error) {
          logger.error(`Failed to extract session: ${error}`);
        }
      },
    };

    authStrategy = new RemoteAuth({
      store: fileStore,
      dataPath: authDataPath,
      backupSyncIntervalMs: 300000, // Backup every 5 minutes
    });
  } else {
    // NoAuth: no persistence, requires QR scan on each startup
    authStrategy = new NoAuth();
  }

  // When using LocalAuth or RemoteAuth, don't set userDataDir in puppeteer args
  // They manage the userDataDir themselves
  // Add additional args to prevent lock file issues
  const docker_args = (config.authStrategy === 'local' || config.authStrategy === 'json')
    ? {
        headless: true,
        args: [
          '--no-sandbox',
          '--single-process',
          '--no-zygote',
          '--disable-dev-shm-usage',
          '--disable-setuid-sandbox',
          '--disable-gpu',
          '--disable-software-rasterizer',
        ],
      }
    : {
        headless: true,
        userDataDir: authDataPath,
        args: [
          '--no-sandbox',
          '--single-process',
          '--no-zygote',
          '--disable-dev-shm-usage',
          '--disable-setuid-sandbox',
          '--disable-gpu',
          '--disable-software-rasterizer',
        ],
      };

  const puppeteer = config.dockerContainer ? docker_args : npx_args;

  const client = new Client({
    puppeteer,
    authStrategy,
    restartOnAuthFail: true,
  });

  // Generate QR code when needed
  client.on('qr', (qr: string) => {
    // Display QR code in terminal
    qrcode.generate(qr, { small: true }, qrcode => {
      logger.info(`QR code generated. Scan it with your phone to log in.\n${qrcode}`);
    });
  });

  // Handle ready event
  client.on('ready', async () => {
    logger.info('Client is ready!');
  });

  // Handle authenticated event
  client.on('authenticated', () => {
    logger.info('Authentication successful!');
  });

  // Handle auth failure event
  client.on('auth_failure', (msg: string) => {
    logger.error('Authentication failed:', msg);
  });

  // Handle disconnected event
  client.on('disconnected', (reason: string) => {
    logger.warn('Client was disconnected:', reason);
  });

  // Handle incoming messages
  client.on('message', async (message: Message) => {
    const contact = await message.getContact();
    logger.debug(`${contact.pushname} (${contact.number}): ${message.body}`);

    // Process webhook if configured
    if (webhookConfig) {
      // Check filters
      const isGroup = message.from.includes('@g.us');

      // Skip if filters don't match
      if (
        (isGroup && webhookConfig.filters?.allowGroups === false) ||
        (!isGroup && webhookConfig.filters?.allowPrivate === false) ||
        (webhookConfig.filters?.allowedNumbers?.length &&
          !webhookConfig.filters.allowedNumbers.includes(contact.number))
      ) {
        return;
      }

      // Determine message type and extract relevant information
      let messageType = 'text';
      let messageContent: any = {
        text: message.body,
      };

      // Check for different message types
      if (message.hasMedia) {
        try {
          const media = await message.downloadMedia();
          if (media) {
            messageType = media.mimetype?.startsWith('image/') ? 'image' :
                         media.mimetype?.startsWith('video/') ? 'video' :
                         media.mimetype?.startsWith('audio/') ? 'audio' :
                         media.mimetype?.startsWith('application/') ? 'document' :
                         'media';
            
            messageContent = {
              type: messageType,
              mimetype: media.mimetype,
              filename: media.filename || 'unknown',
              data: media.data, // Base64 data
              caption: message.body || '',
            };
          }
        } catch (error) {
          // Media download failed (e.g., message too old, deleted, or unavailable)
          logger.warn(`Failed to download media from message ${message.id._serialized}: ${error instanceof Error ? error.message : String(error)}`);
          // Fall back to text message with media indicator
          messageType = 'media';
          messageContent = {
            type: 'media',
            text: message.body || '',
            error: 'Media unavailable or could not be downloaded',
          };
        }
      } else if (message.type === 'sticker') {
        messageType = 'sticker';
        messageContent = {
          type: 'sticker',
          text: message.body || '',
        };
      } else if (message.type === 'location') {
        messageType = 'location';
        messageContent = {
          type: 'location',
          latitude: message.location?.latitude,
          longitude: message.location?.longitude,
          address: message.location?.address,
        };
      } else if (message.type === 'vcard') {
        messageType = 'contact';
        messageContent = {
          type: 'contact',
          contact: message.vCards || [],
        };
      } else if (message.type === 'reaction') {
        messageType = 'reaction';
        messageContent = {
          type: 'reaction',
          emoji: message.body,
          quotedMessageId: (message as any).quotedMsgId,
        };
      } else if ((message as any).type === 'group_invite') {
        messageType = 'group_invite';
        messageContent = {
          type: 'group_invite',
          inviteCode: message.inviteV4?.inviteCode,
          inviteExpiration: (message.inviteV4 as any)?.inviteExpiration,
          groupName: message.inviteV4?.groupName,
        };
      } else {
        // Default to text message
        messageContent = {
          type: 'text',
          text: message.body,
        };
      }

      // Get group information if it's a group message
      let groupInfo = null;
      if (isGroup) {
        try {
          const chat = await message.getChat();
          if (chat.isGroup) {
            groupInfo = {
              id: chat.id._serialized,
              name: chat.name,
              participants: (chat as any).participants?.map((p: any) => ({
                id: p.id._serialized,
                name: p.name || p.pushname,
              })) || [],
            };
          }
        } catch (error) {
          logger.warn('Failed to get group info:', error);
        }
      }

      // Send enhanced webhook payload
      try {
        const webhookPayload = {
          // Basic message info
          messageId: message.id._serialized,
          timestamp: message.timestamp,
          from: contact.number,
          name: contact.pushname,
          
          // Message type and content
          messageType,
          content: messageContent,
          
          // Chat context
          isGroup,
          groupInfo,
          
          // Additional metadata
          hasQuotedMessage: !!(message as any).quotedMsgId,
          quotedMessageId: (message as any).quotedMsgId,
          forwarded: message.isForwarded,
          
          // Raw message data for advanced use cases
          raw: {
            type: message.type,
            from: message.from,
            to: message.to,
            body: message.body,
            hasMedia: message.hasMedia,
            isForwarded: message.isForwarded,
            isStatus: message.isStatus,
            isStarred: message.isStarred,
          }
        };

        const response = await axios.post(
          webhookConfig.url,
          webhookPayload,
          {
            headers: {
              'Content-Type': 'application/json',
              ...(webhookConfig.authToken
                ? { Authorization: `Bearer ${webhookConfig.authToken}` }
                : {}),
            },
          },
        );

        if (response.status < 200 || response.status >= 300) {
          logger.warn(`Webhook request failed with status ${response.status}`);
        } else {
          logger.debug(`Webhook sent successfully for ${messageType} message from ${contact.number}`);
        }
      } catch (error) {
        logger.error('Error sending webhook:', error);
      }
    }
  });

  return client;
}
