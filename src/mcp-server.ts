import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { WhatsAppService } from './whatsapp-service';
import { WhatsAppApiClient } from './whatsapp-api-client';
import { WhatsAppConfig, updateWebhookConfig, getCurrentWebhookConfig } from './whatsapp-client';
import { Client } from 'whatsapp-web.js';
import fs from 'fs';
import path from 'path';
import axios from 'axios';

// Configuration interface
export interface McpConfig {
  useApiClient?: boolean;
  apiBaseUrl?: string;
  apiKey?: string;
  whatsappConfig?: WhatsAppConfig;
}

/**
 * Creates an MCP server that exposes WhatsApp functionality through the Model Context Protocol
 * This allows AI models like Claude to interact with WhatsApp through a standardized interface
 *
 * @param mcpConfig Configuration for the MCP server
 * @returns The configured MCP server
 */
export function createMcpServer(config: McpConfig = {}, client: Client | null = null): McpServer {
  const server = new McpServer({
    name: 'WhatsApp-Web-MCP',
    version: '1.0.0',
    description: 'WhatsApp Web API exposed through Model Context Protocol',
  });

  let service: WhatsAppApiClient | WhatsAppService;

  if (config.useApiClient) {
    if (!config.apiBaseUrl) {
      throw new Error('API base URL is required when useApiClient is true');
    }
    service = new WhatsAppApiClient(config.apiBaseUrl, config.apiKey || '');
  } else {
    if (!client) {
      throw new Error('WhatsApp client is required when useApiClient is false');
    }
    service = new WhatsAppService(client);
  }

  // Resource to list contacts
  server.resource('contacts', 'whatsapp://contacts', async uri => {
    try {
      const contacts = await service.getContacts();

      return {
        contents: [
          {
            uri: uri.href,
            text: JSON.stringify(contacts, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to fetch contacts: ${error}`);
    }
  });

  // Resource to get chat messages
  server.resource(
    'messages',
    new ResourceTemplate('whatsapp://messages/{number}', { list: undefined }),
    async (uri, { number }) => {
      try {
        // Ensure number is a string
        const phoneNumber = Array.isArray(number) ? number[0] : number;
        const messages = await service.getMessages(phoneNumber, 10);

        return {
          contents: [
            {
              uri: uri.href,
              text: JSON.stringify(messages, null, 2),
            },
          ],
        };
      } catch (error) {
        throw new Error(`Failed to fetch messages: ${error}`);
      }
    },
  );

  // Resource to get chat list
  server.resource('chats', 'whatsapp://chats', async uri => {
    try {
      const chats = await service.getChats();

      return {
        contents: [
          {
            uri: uri.href,
            text: JSON.stringify(chats, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to fetch chats: ${error}`);
    }
  });

  // Tool to get WhatsApp connection status
  server.tool(
    'get_status',
    {
      description: 'Get the current WhatsApp connection status and client information',
    },
    async () => {
    try {
      const status = await service.getStatus();

      return {
        content: [
          {
            type: 'text',
            text: `WhatsApp connection status: ${status.status}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error getting status: ${error}`,
          },
        ],
        isError: true,
      };
    }
  });

  // Tool to search contacts
  server.tool(
    'search_contacts',
    {
      description: 'Search for contacts by name or phone number',
      query: z.string().describe('Search query to find contacts by name or number'),
    },
    async ({ query }) => {
      try {
        const contacts = await service.searchContacts(query);

        return {
          content: [
            {
              type: 'text',
              text: `Found ${contacts.length} contacts matching "${query}":\n${JSON.stringify(contacts, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error searching contacts: ${error}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Tool to get messages from a specific chat
  server.tool(
    'get_messages',
    {
      description: 'Get recent messages from a specific contact or chat',
      number: z.string().describe('The phone number to get messages from'),
      limit: z.number().describe('The number of messages to get (default: 10)'),
    },
    async ({ number, limit = 10 }) => {
      try {
        const messages = await service.getMessages(number, limit);

        return {
          content: [
            {
              type: 'text',
              text: `Retrieved ${messages.length} messages from ${number}:\n${JSON.stringify(messages, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error getting messages: ${error}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Tool to get all chats
  server.tool(
    'get_chats',
    {
      description: 'Get all chats (conversations) from WhatsApp',
    },
    async () => {
    try {
      const chats = await service.getChats();

      return {
        content: [
          {
            type: 'text',
            text: `Retrieved ${chats.length} chats:\n${JSON.stringify(chats, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error getting chats: ${error}`,
          },
        ],
        isError: true,
      };
    }
  });

  // Tool to send a message
  server.tool(
    'send_message',
    {
      description: 'Send a text message to a specific phone number',
      number: z.string().describe('The phone number to send the message to'),
      message: z.string().describe('The message content to send'),
    },
    async ({ number, message }) => {
      try {
        const result = await service.sendMessage(number, message);

        return {
          content: [
            {
              type: 'text',
              text: `Message sent successfully to ${number}. Message ID: ${result.messageId}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error sending message: ${error}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Resource to list groups
  server.resource('groups', 'whatsapp://groups', async uri => {
    try {
      const groups = await service.getGroups();

      return {
        contents: [
          {
            uri: uri.href,
            text: JSON.stringify(groups, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to fetch groups: ${error}`);
    }
  });

  // Resource to search groups
  server.resource(
    'search_groups',
    new ResourceTemplate('whatsapp://groups/search', { list: undefined }),
    async (uri, _params) => {
      try {
        // Extract query parameter from URL search params
        const queryString = uri.searchParams.get('query') || '';
        const groups = await service.searchGroups(queryString);

        return {
          contents: [
            {
              uri: uri.href,
              text: JSON.stringify(groups, null, 2),
            },
          ],
        };
      } catch (error) {
        throw new Error(`Failed to search groups: ${error}`);
      }
    },
  );

  // Resource to get group messages
  server.resource(
    'group_messages',
    new ResourceTemplate('whatsapp://groups/{groupId}/messages', { list: undefined }),
    async (uri, { groupId }) => {
      try {
        // Ensure groupId is a string
        const groupIdString = Array.isArray(groupId) ? groupId[0] : groupId;
        const messages = await service.getGroupMessages(groupIdString, 10);

        return {
          contents: [
            {
              uri: uri.href,
              text: JSON.stringify(messages, null, 2),
            },
          ],
        };
      } catch (error) {
        throw new Error(`Failed to fetch group messages: ${error}`);
      }
    },
  );

  // Tool to create a group
  server.tool(
    'create_group',
    {
      description: 'Create a new WhatsApp group with specified participants',
      name: z.string().describe('The name of the group to create'),
      participants: z.array(z.string()).describe('Array of phone numbers to add to the group'),
      timeout: z.number().optional().describe('Timeout in milliseconds (default: 60000)'),
      retries: z.number().optional().describe('Number of retries (default: 3)'),
      retryDelay: z.number().optional().describe('Delay between retries in milliseconds (default: 2000)'),
    },
    async ({ name, participants, timeout, retries, retryDelay }) => {
      try {
        const options = {
          timeout,
          retries,
          retryDelay,
        };

        const result = await service.createGroup(name, participants, options);

        return {
          content: [
            {
              type: 'text',
              text: `Group created successfully. Group ID: ${result.groupId}${
                result.inviteCode ? `\nInvite code: ${result.inviteCode}` : ''
              }`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error creating group: ${error}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Tool to add participants to a group
  server.tool(
    'add_participants_to_group',
    {
      description: 'Add new participants to an existing WhatsApp group',
      groupId: z.string().describe('The ID of the group to add participants to'),
      participants: z.array(z.string()).describe('Array of phone numbers to add to the group'),
    },
    async ({ groupId, participants }) => {
      try {
        const result = await service.addParticipantsToGroup(groupId, participants);

        return {
          content: [
            {
              type: 'text',
              text: `Added ${result.added.length} participants to group ${groupId}${
                result.failed && result.failed.length > 0
                  ? `\nFailed to add ${result.failed.length} participants: ${JSON.stringify(
                      result.failed,
                    )}`
                  : ''
              }`,
            },
          ],
        };
      } catch (error) {
        const errorMsg = String(error);

        if (errorMsg.includes('not supported in the current version')) {
          return {
            content: [
              {
                type: 'text',
                text: 'Adding participants to groups is not supported with the current WhatsApp API configuration. This feature requires a newer version of whatsapp-web.js that has native support for adding participants.',
              },
            ],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: `Error adding participants to group: ${error}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Tool to get group messages
  server.tool(
    'get_group_messages',
    {
      description: 'Get recent messages from a specific WhatsApp group',
      groupId: z.string().describe('The ID of the group to get messages from'),
      limit: z.number().describe('The number of messages to get (default: 10)'),
    },
    async ({ groupId, limit = 10 }) => {
      try {
        const messages = await service.getGroupMessages(groupId, limit);

        return {
          content: [
            {
              type: 'text',
              text: `Retrieved ${messages.length} messages from group ${groupId}:\n${JSON.stringify(
                messages,
                null,
                2,
              )}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error getting group messages: ${error}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Tool to send a message to a group
  server.tool(
    'send_group_message',
    {
      description: 'Send a text message to a specific WhatsApp group',
      groupId: z.string().describe('The ID of the group to send the message to'),
      message: z.string().describe('The message content to send'),
    },
    async ({ groupId, message }) => {
      try {
        const result = await service.sendGroupMessage(groupId, message);

        return {
          content: [
            {
              type: 'text',
              text: `Message sent successfully to group ${groupId}. Message ID: ${result.messageId}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error sending message to group: ${error}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Tool to search groups
  server.tool(
    'search_groups',
    {
      description: 'Search for WhatsApp groups by name, description, or member names',
      query: z
        .string()
        .describe('Search query to find groups by name, description, or member names'),
    },
    async ({ query }) => {
      try {
        const groups = await service.searchGroups(query);

        let noticeMsg = '';
        if (!config.useApiClient) {
          noticeMsg =
            '\n\nNote: Some group details like descriptions or complete participant lists may be limited due to API restrictions.';
        }

        return {
          content: [
            {
              type: 'text',
              text: `Found ${groups.length} groups matching "${query}":\n${JSON.stringify(
                groups,
                null,
                2,
              )}${noticeMsg}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error searching groups: ${error}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Tool to get group by ID
  server.tool(
    'get_group_by_id',
    {
      description: 'Get detailed information about a specific WhatsApp group by its ID',
      groupId: z.string().describe('The ID of the group to get'),
    },
    async ({ groupId }) => {
      try {
        const group = await service.getGroupById(groupId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(group, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error getting group by ID: ${error}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Tool to download media from a message
  server.tool(
    'download_media_from_message',
    {
      description: 'Download media (images, videos, audio, documents) from a specific message',
      messageId: z.string().describe('The ID of the message containing the media'),
    },
    async ({ messageId }) => {
      try {
        // Get the media storage path from the configuration
        const mediaStoragePath = config.whatsappConfig?.mediaStoragePath || '.wwebjs_auth/media';

        // Download the media
        const mediaInfo = await service.downloadMediaFromMessage(messageId, mediaStoragePath);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(mediaInfo, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error downloading media: ${error}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Tool to send a media message
  server.tool(
    'send_media_message',
    {
      description: 'Send media files (images, videos, audio, documents) to a contact',
      number: z.string().describe('The phone number to send the message to'),
      source: z
        .string()
        .describe(
          'The source of the media - URLs must use http:// or https:// prefixes, local files must use file:// prefix. Supports images, audio, video, and documents.',
        ),
      caption: z.string().default('').describe('Caption for the media'),
    },
    async ({ number, source, caption }) => {
      try {
        const result = await service.sendMediaMessage({
          number,
          source,
          caption,
        });

        return {
          content: [
            {
              type: 'text',
              text: `Media message sent successfully to ${number}.\nMessage ID: ${result.messageId}\nMedia Info:\n${JSON.stringify(result.mediaInfo, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error sending media message: ${error}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Tool to send typing state
  server.tool(
    'send_typing_state',
    {
      description: 'Send typing indicator to show that you are typing a message',
      number: z.string().describe('The phone number to send typing state to'),
    },
    async ({ number }) => {
      try {
        await service.sendTypingState(number);

        return {
          content: [
            {
              type: 'text',
              text: `Typing state sent successfully to ${number}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error sending typing state: ${error}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Tool to send recording state
  server.tool(
    'send_recording_state',
    {
      description: 'Send recording indicator to show that you are recording a voice message',
      number: z.string().describe('The phone number to send recording state to'),
    },
    async ({ number }) => {
      try {
        await service.sendRecordingState(number);

        return {
          content: [
            {
              type: 'text',
              text: `Recording state sent successfully to ${number}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error sending recording state: ${error}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Tool to send seen state
  server.tool(
    'send_seen_state',
    {
      description: 'Mark messages as read/seen in a conversation',
      number: z.string().describe('The phone number to mark messages as seen'),
    },
    async ({ number }) => {
      try {
        await service.sendSeen(number);

        return {
          content: [
            {
              type: 'text',
              text: `Seen state sent successfully to ${number}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error sending seen state: ${error}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Tool to send sticker
  server.tool(
    'send_sticker',
    {
      description: 'Send a sticker to a contact',
      number: z.string().describe('The phone number to send the sticker to'),
      source: z
        .string()
        .describe(
          'The source of the sticker - URLs must use http:// or https:// prefixes, local files must use file:// prefix',
        ),
    },
    async ({ number, source }) => {
      try {
        const result = await service.sendSticker({ number, source });

        return {
          content: [
            {
              type: 'text',
              text: `Sticker sent successfully to ${number}. Message ID: ${result.messageId}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error sending sticker: ${error}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Tool to create and send sticker from image
  server.tool(
    'create_sticker_from_image',
    {
      description: 'Create a sticker from an image and send it to a contact',
      number: z.string().describe('The phone number to send the sticker to'),
      source: z
        .string()
        .describe(
          'The source of the image to convert to sticker - URLs must use http:// or https:// prefixes, local files must use file:// prefix',
        ),
    },
    async ({ number, source }) => {
      try {
        const result = await service.createStickerFromImage({ number, source });

        return {
          content: [
            {
              type: 'text',
              text: `Sticker created and sent successfully to ${number}. Message ID: ${result.messageId}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error creating and sending sticker: ${error}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Tool to send voice message (Voice Note)
  server.tool(
    'send_voice_message',
    {
      description: 'Send a voice message (voice note) to a contact',
      number: z.string().describe('The phone number to send the voice message to'),
      source: z
        .string()
        .describe(
          'The source of the audio file to send as voice message - URLs must use http:// or https:// prefixes, local files must use file:// prefix',
        ),
      duration: z.number().optional().describe('Duration of the voice message in seconds (optional)'),
    },
    async ({ number, source, duration }) => {
      try {
        const result = await service.sendVoiceMessage({ number, source, duration });

        return {
          content: [
            {
              type: 'text',
              text: `Voice message sent successfully to ${number}. Message ID: ${result.messageId}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error sending voice message: ${error}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Tool to send audio file (Audio File)
  server.tool(
    'send_audio_file',
    {
      description: 'Send an audio file (not voice message) to a contact',
      number: z.string().describe('The phone number to send the audio file to'),
      source: z
        .string()
        .describe(
          'The source of the audio file - URLs must use http:// or https:// prefixes, local files must use file:// prefix',
        ),
      caption: z.string().optional().describe('Optional caption for the audio file'),
    },
    async ({ number, source, caption }) => {
      try {
        const result = await service.sendAudioFile({ number, source, caption });

        return {
          content: [
            {
              type: 'text',
              text: `Audio file sent successfully to ${number}. Message ID: ${result.messageId}\nMedia Info:\n${JSON.stringify(result.mediaInfo, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error sending audio file: ${error}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Tool to test webhook configuration
  server.tool(
    'test_webhook',
    {
      description: 'Test webhook configuration by sending a sample payload',
      url: z.string().describe('Webhook URL to test'),
      authToken: z.string().optional().describe('Optional authentication token'),
    },
    async ({ url, authToken }) => {
      try {
        const testPayload = {
          from: '1234567890',
          name: 'Test User',
          message: 'This is a test message',
          isGroup: false,
          timestamp: Math.floor(Date.now() / 1000),
          messageId: 'test_message_id',
          fromMe: false,
          type: 'text',
          deviceType: 'android',
          isForwarded: false,
          isStarred: false,
          hasQuotedMsg: false,
          hasReaction: false,
          isEphemeral: false,
          messageType: 'text',
          content: {
            text: 'This is a test message',
          },
        };

        const response = await axios.post(url, testPayload, {
          headers: {
            'Content-Type': 'application/json',
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          },
        });

        return {
          content: [
            {
              type: 'text',
              text: `Webhook test completed. Status: ${response.status} ${response.statusText}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Webhook test failed: ${error}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Tool to update webhook configuration dynamically
  server.tool(
    'update_webhook_config',
    {
      description: 'Update webhook configuration without restart',
      url: z.string().describe('New webhook URL'),
      authToken: z.string().optional().describe('New authentication token'),
      configPath: z.string().optional().describe('Custom path for webhook config file'),
      saveToFile: z.boolean().optional().describe('Save to file for persistence (default: true)'),
      filters: z.object({
        allowedNumbers: z.array(z.string()).optional().describe('Array of allowed phone numbers'),
        allowPrivate: z.boolean().optional().describe('Allow private messages (default: true)'),
        allowGroups: z.boolean().optional().describe('Allow group messages (default: true)'),
      }).optional().describe('Message filters'),
    },
    async ({ url, authToken, configPath, saveToFile = true, filters }) => {
      try {
        const newConfig = {
          url,
          authToken,
          filters: {
            allowedNumbers: filters?.allowedNumbers || [],
            allowPrivate: filters?.allowPrivate !== undefined ? filters.allowPrivate : true,
            allowGroups: filters?.allowGroups !== undefined ? filters.allowGroups : true,
          },
        };

        // Update in memory
        updateWebhookConfig(newConfig, saveToFile);

        // Save to custom path if specified
        if (saveToFile && configPath) {
          try {
            const dir = path.dirname(configPath);
            if (!fs.existsSync(dir)) {
              fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2));
          } catch (error) {
            return {
              content: [
                {
                  type: 'text',
                  text: `Webhook config updated in memory but failed to save to custom path: ${error}`,
                },
              ],
              isError: true,
            };
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: `Webhook configuration updated successfully!\nURL: ${url}\nAuth Token: ${authToken ? '***' : 'None'}\nSave to File: ${saveToFile}\nFilters: ${JSON.stringify(newConfig.filters, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Failed to update webhook config: ${error}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Tool to get current webhook configuration
  server.tool(
    'get_current_webhook_config',
    {
      description: 'Get current webhook configuration from memory',
    },
    async () => {
      try {
        const config = getCurrentWebhookConfig();
        
        if (!config) {
          return {
            content: [
              {
                type: 'text',
                text: 'No webhook configuration is currently active',
              },
            ],
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: `Current Webhook Configuration:\n${JSON.stringify(config, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Failed to get webhook config: ${error}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Tool to disable webhook
  server.tool(
    'disable_webhook',
    {
      description: 'Disable webhook functionality',
      saveToFile: z.boolean().optional().describe('Save changes to file (default: true)'),
    },
    async ({ saveToFile = true }) => {
      try {
        // Clear the webhook config
        updateWebhookConfig(undefined as any, saveToFile);

        return {
          content: [
            {
              type: 'text',
              text: 'Webhook has been disabled successfully',
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Failed to disable webhook: ${error}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Tool to reload webhook config from file
  server.tool(
    'reload_webhook_config',
    {
      description: 'Reload webhook configuration from file',
      configPath: z.string().optional().describe('Path to webhook config file'),
    },
    async ({ configPath }) => {
      try {
        const filePath = configPath || '.wwebjs_auth/webhook.json';
        
        if (!fs.existsSync(filePath)) {
          return {
            content: [
              {
                type: 'text',
                text: `Webhook config file not found at: ${filePath}`,
              },
            ],
            isError: true,
          };
        }

        const config = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        updateWebhookConfig(config, false); // Don't save to file since we just loaded from it

        return {
          content: [
            {
              type: 'text',
              text: `Webhook configuration reloaded from file: ${filePath}\n${JSON.stringify(config, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Failed to reload webhook config: ${error}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  return server;
}
