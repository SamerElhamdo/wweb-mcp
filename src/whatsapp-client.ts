import { Client, LocalAuth, Message, NoAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import logger from './logger';
import fs from 'fs';
import path from 'path';
import axios from 'axios';

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

function loadWebhookConfig(dataPath: string): WebhookConfig | undefined {
  const webhookConfigPath = path.join(dataPath, 'webhook.json');
  if (!fs.existsSync(webhookConfigPath)) {
    return undefined;
  }
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

  // Handle vote update events
  client.on('vote_update', async (vote: any) => {
    logger.debug('Vote update received:', vote);

    // Process webhook if configured
    if (webhookConfig) {
      // Send to webhook
      try {
        const response = await axios.post(
          webhookConfig.url,
          {
            event: 'vote_update',
            vote: vote,
            timestamp: Date.now(),
          },
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

  return client;
}
