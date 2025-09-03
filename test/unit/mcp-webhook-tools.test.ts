import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { createMcpServer } from '../../src/mcp-server';
import { updateWebhookConfig, getCurrentWebhookConfig } from '../../src/whatsapp-client';

// Mock the whatsapp-client module
jest.mock('../../src/whatsapp-client', () => ({
  updateWebhookConfig: jest.fn(),
  getCurrentWebhookConfig: jest.fn(),
  createWhatsAppClient: jest.fn(),
}));

// Mock the service modules
jest.mock('../../src/whatsapp-service');
jest.mock('../../src/whatsapp-api-client');

describe('MCP Webhook Tools', () => {
  let server: any;
  const mockClient = {} as any;

  beforeEach(() => {
    jest.clearAllMocks();
    server = createMcpServer({ useApiClient: false }, mockClient);
  });

  describe('update_webhook_config tool', () => {
    it('should update webhook configuration successfully', async () => {
      const mockUpdateWebhookConfig = updateWebhookConfig as jest.MockedFunction<typeof updateWebhookConfig>;
      mockUpdateWebhookConfig.mockImplementation(() => {});

      const result = await server.tools.update_webhook_config.handler({
        url: 'https://test-webhook.com/endpoint',
        authToken: 'test-token',
        saveToFile: true,
        filters: {
          allowedNumbers: ['1234567890'],
          allowPrivate: true,
          allowGroups: false,
        },
      });

      expect(mockUpdateWebhookConfig).toHaveBeenCalledWith(
        {
          url: 'https://test-webhook.com/endpoint',
          authToken: 'test-token',
          filters: {
            allowedNumbers: ['1234567890'],
            allowPrivate: true,
            allowGroups: false,
          },
        },
        true
      );

      expect(result.content[0].text).toContain('Webhook configuration updated successfully');
    });

    it('should handle errors gracefully', async () => {
      const mockUpdateWebhookConfig = updateWebhookConfig as jest.MockedFunction<typeof updateWebhookConfig>;
      mockUpdateWebhookConfig.mockImplementation(() => {
        throw new Error('Update failed');
      });

      const result = await server.tools.update_webhook_config.handler({
        url: 'https://test-webhook.com/endpoint',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Failed to update webhook config');
    });
  });

  describe('get_current_webhook_config tool', () => {
    it('should return current webhook configuration', async () => {
      const mockGetCurrentWebhookConfig = getCurrentWebhookConfig as jest.MockedFunction<typeof getCurrentWebhookConfig>;
      const testConfig = {
        url: 'https://test-webhook.com/endpoint',
        authToken: 'test-token',
        filters: {
          allowedNumbers: ['1234567890'],
          allowPrivate: true,
          allowGroups: false,
        },
      };
      
      mockGetCurrentWebhookConfig.mockReturnValue(testConfig);

      const result = await server.tools.get_current_webhook_config.handler({});

      expect(mockGetCurrentWebhookConfig).toHaveBeenCalled();
      expect(result.content[0].text).toContain('Current Webhook Configuration');
      expect(result.content[0].text).toContain('https://test-webhook.com/endpoint');
    });

    it('should return message when no config is active', async () => {
      const mockGetCurrentWebhookConfig = getCurrentWebhookConfig as jest.MockedFunction<typeof getCurrentWebhookConfig>;
      mockGetCurrentWebhookConfig.mockReturnValue(undefined);

      const result = await server.tools.get_current_webhook_config.handler({});

      expect(result.content[0].text).toContain('No webhook configuration is currently active');
    });
  });

  describe('disable_webhook tool', () => {
    it('should disable webhook successfully', async () => {
      const mockUpdateWebhookConfig = updateWebhookConfig as jest.MockedFunction<typeof updateWebhookConfig>;
      mockUpdateWebhookConfig.mockImplementation(() => {});

      const result = await server.tools.disable_webhook.handler({
        saveToFile: true,
      });

      expect(mockUpdateWebhookConfig).toHaveBeenCalledWith(undefined, true);
      expect(result.content[0].text).toContain('Webhook has been disabled successfully');
    });
  });

  describe('reload_webhook_config tool', () => {
    it('should reload webhook config from file', async () => {
      const mockFs = require('fs');
      const mockUpdateWebhookConfig = updateWebhookConfig as jest.MockedFunction<typeof updateWebhookConfig>;
      
      const testConfig = {
        url: 'https://reloaded-webhook.com/endpoint',
        authToken: 'reloaded-token',
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(testConfig));
      mockUpdateWebhookConfig.mockImplementation(() => {});

      const result = await server.tools.reload_webhook_config.handler({
        configPath: '/test/webhook.json',
      });

      expect(mockFs.readFileSync).toHaveBeenCalledWith('/test/webhook.json', 'utf8');
      expect(mockUpdateWebhookConfig).toHaveBeenCalledWith(testConfig, false);
      expect(result.content[0].text).toContain('Webhook configuration reloaded from file');
    });

    it('should handle missing config file', async () => {
      const mockFs = require('fs');
      mockFs.existsSync.mockReturnValue(false);

      const result = await server.tools.reload_webhook_config.handler({
        configPath: '/nonexistent/webhook.json',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Webhook config file not found');
    });
  });
});
