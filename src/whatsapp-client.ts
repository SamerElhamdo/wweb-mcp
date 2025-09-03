import { Client, LocalAuth, Message, NoAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import logger from './logger';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { watch } from 'fs';

// Configuration interface
export interface WhatsAppConfig {
  authDataPath?: string;
  authStrategy?: 'local' | 'none';
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

// Global variables for dynamic webhook management
let currentWebhookConfig: WebhookConfig | undefined;
let configWatcher: any;
let webhookConfigPath: string;

function loadWebhookConfig(dataPath: string): WebhookConfig | undefined {
  webhookConfigPath = path.join(dataPath, 'webhook.json');
  
  // Load initial config
  if (fs.existsSync(webhookConfigPath)) {
    try {
      currentWebhookConfig = JSON.parse(fs.readFileSync(webhookConfigPath, 'utf8'));
      logger.info('Webhook config loaded successfully');
    } catch (error) {
      logger.error('Failed to load webhook config:', error);
      currentWebhookConfig = undefined;
    }
  } else {
    currentWebhookConfig = undefined;
  }
  
  // Set up file watching for dynamic updates
  setupWebhookConfigWatcher();
  
  return currentWebhookConfig;
}

function setupWebhookConfigWatcher() {
  // Close existing watcher if any
  if (configWatcher) {
    configWatcher.close();
  }
  
  // Only watch if file exists
  if (fs.existsSync(webhookConfigPath)) {
    configWatcher = watch(webhookConfigPath, (eventType) => {
      if (eventType === 'change') {
        logger.info('Webhook config file changed, reloading...');
        try {
          currentWebhookConfig = JSON.parse(fs.readFileSync(webhookConfigPath, 'utf8'));
          logger.info('Webhook config reloaded successfully');
        } catch (error) {
          logger.error('Failed to reload webhook config:', error);
        }
      }
    });
    logger.info('Webhook config file watcher started');
  }
}

// Function to update webhook config dynamically
export function updateWebhookConfig(newConfig: WebhookConfig, saveToFile: boolean = true) {
  currentWebhookConfig = newConfig;
  logger.info('Webhook config updated dynamically');
  
  if (saveToFile && webhookConfigPath) {
    try {
      fs.writeFileSync(webhookConfigPath, JSON.stringify(newConfig, null, 2));
      logger.info('Webhook config saved to file');
    } catch (error) {
      logger.error('Failed to save webhook config to file:', error);
    }
  }
}

// Function to get current webhook config
export function getCurrentWebhookConfig(): WebhookConfig | undefined {
  return currentWebhookConfig;
}

export function createWhatsAppClient(config: WhatsAppConfig = {}): Client {
  const authDataPath = config.authDataPath || '.wwebjs_auth';
  const mediaStoragePath = config.mediaStoragePath || path.join(authDataPath, 'media');

  loadWebhookConfig(authDataPath);

  // Create media storage directory if it doesn't exist
  if (!fs.existsSync(mediaStoragePath)) {
    try {
      fs.mkdirSync(mediaStoragePath, { recursive: true });
      logger.info(`Created media storage directory: ${mediaStoragePath}`);
    } catch (error) {
      logger.error(`Failed to create media storage directory: ${error}`);
    }
  }

  // remove Chrome lock file if it exists
  try {
    fs.rmSync(authDataPath + '/SingletonLock', { force: true });
  } catch {
    // Ignore if file doesn't exist
  }

  const npx_args = { headless: true };
  const docker_args = {
    headless: true,
    userDataDir: authDataPath,
    args: ['--no-sandbox', '--single-process', '--no-zygote'],
  };

  const authStrategy =
    config.authStrategy === 'local' && !config.dockerContainer
      ? new LocalAuth({
          dataPath: authDataPath,
        })
      : new NoAuth();

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
    const webhookConfig = currentWebhookConfig;
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

      // Prepare enhanced webhook payload
      try {
        const webhookPayload = await prepareWebhookPayload(message, contact, isGroup);
        
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
        }
      } catch (error) {
        logger.error('Error sending webhook:', error);
      }
    }
  });

  // Helper function to prepare enhanced webhook payload
  async function prepareWebhookPayload(message: Message, contact: any, isGroup: boolean) {
    const basePayload = {
      from: contact.number,
      name: contact.pushname,
      message: message.body,
      isGroup,
      timestamp: message.timestamp,
      messageId: message.id._serialized,
      fromMe: message.fromMe,
      type: message.type,
      deviceType: message.deviceType,
      isForwarded: message.isForwarded,
      isStarred: message.isStarred,
      hasQuotedMsg: message.hasQuotedMsg,
      hasReaction: message.hasReaction,
      isEphemeral: message.isEphemeral,
    };

    // Add message type specific information
    const enhancedPayload: any = { ...basePayload };

    // Handle different message types
    switch (message.type) {
      case 'text':
        enhancedPayload.messageType = 'text';
        enhancedPayload.content = {
          text: message.body,
        };
        break;

      case 'image':
        enhancedPayload.messageType = 'image';
        enhancedPayload.content = {
          caption: message.body || '',
          hasMedia: true,
          mediaType: 'image',
        };
        break;

      case 'video':
        enhancedPayload.messageType = 'video';
        enhancedPayload.content = {
          caption: message.body || '',
          hasMedia: true,
          mediaType: 'video',
          duration: message.duration || 0,
        };
        break;

      case 'audio':
        enhancedPayload.messageType = 'audio';
        enhancedPayload.content = {
          hasMedia: true,
          mediaType: 'audio',
          duration: message.duration || 0,
          isVoiceMessage: false, // Regular audio file
        };
        break;

      case 'voice':
        enhancedPayload.messageType = 'voice';
        enhancedPayload.content = {
          hasMedia: true,
          mediaType: 'voice',
          duration: message.duration || 0,
          isVoiceMessage: true, // Voice note
        };
        break;

      case 'document':
        enhancedPayload.messageType = 'document';
        enhancedPayload.content = {
          caption: message.body || '',
          hasMedia: true,
          mediaType: 'document',
          filename: message.filename || 'unknown',
        };
        break;

      case 'sticker':
        enhancedPayload.messageType = 'sticker';
        enhancedPayload.content = {
          hasMedia: true,
          mediaType: 'sticker',
        };
        break;

      case 'location':
        enhancedPayload.messageType = 'location';
        enhancedPayload.content = {
          location: {
            latitude: message.location?.latitude,
            longitude: message.location?.longitude,
            name: message.location?.name,
            address: message.location?.address,
          },
        };
        break;

      case 'contact':
        enhancedPayload.messageType = 'contact';
        enhancedPayload.content = {
          contact: message.vCards || [],
        };
        break;

      case 'reaction':
        enhancedPayload.messageType = 'reaction';
        enhancedPayload.content = {
          reaction: message.body,
          quotedMessageId: message.quotedMsgId,
        };
        break;

      case 'group_invite':
        enhancedPayload.messageType = 'group_invite';
        enhancedPayload.content = {
          inviteCode: message.inviteV4?.inviteCode,
          inviteExpiration: message.inviteV4?.inviteExpiration,
        };
        break;

      default:
        enhancedPayload.messageType = 'unknown';
        enhancedPayload.content = {
          text: message.body || '',
          hasMedia: message.hasMedia,
        };
    }

    // Add media information if present
    if (message.hasMedia) {
      try {
        const media = await message.downloadMedia();
        if (media) {
          enhancedPayload.media = {
            mimetype: media.mimetype,
            filename: media.filename,
            filesize: media.filesize,
            data: media.data, // Base64 data
          };
        }
      } catch (error) {
        logger.warn('Failed to download media for webhook:', error);
        enhancedPayload.media = {
          error: 'Failed to download media',
        };
      }
    }

    // Add quoted message information if present
    if (message.hasQuotedMsg) {
      try {
        const quotedMessage = await message.getQuotedMessage();
        enhancedPayload.quotedMessage = {
          messageId: quotedMessage.id._serialized,
          body: quotedMessage.body,
          type: quotedMessage.type,
          fromMe: quotedMessage.fromMe,
        };
      } catch (error) {
        logger.warn('Failed to get quoted message for webhook:', error);
      }
    }

    // Add group information if it's a group message
    if (isGroup) {
      try {
        const chat = await message.getChat();
        enhancedPayload.group = {
          id: chat.id._serialized,
          name: chat.name,
          participants: chat.participants?.map((p: any) => ({
            id: p.id._serialized,
            number: p.id.user,
            isAdmin: p.isAdmin,
          })) || [],
        };
      } catch (error) {
        logger.warn('Failed to get group information for webhook:', error);
      }
    }

    // Add mentions if present
    if (message.mentionedIds && message.mentionedIds.length > 0) {
      enhancedPayload.mentions = message.mentionedIds.map((id: string) => ({
        id,
        number: id.split('@')[0],
      }));
    }

    return enhancedPayload;
  }

  return client;
}
