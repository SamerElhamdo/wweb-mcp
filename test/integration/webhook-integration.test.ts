import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import axios from 'axios';
import { createMcpServer } from '../../src/mcp-server';
import { updateWebhookConfig, getCurrentWebhookConfig } from '../../src/whatsapp-client';

// Mock axios for webhook testing
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Webhook Integration Tests', () => {
  let server: any;
  const mockClient = {} as any;

  beforeAll(() => {
    server = createMcpServer({ useApiClient: false }, mockClient);
  });

  afterAll(() => {
    jest.clearAllMocks();
  });

  describe('Webhook Configuration Flow', () => {
    it('should complete full webhook configuration workflow', async () => {
      // Step 1: Update webhook config
      const updateResult = await server.tools.update_webhook_config.handler({
        url: 'https://test-webhook.com/endpoint',
        authToken: 'test-token',
        saveToFile: false,
        filters: {
          allowedNumbers: ['1234567890'],
          allowPrivate: true,
          allowGroups: false,
        },
      });

      expect(updateResult.content[0].text).toContain('Webhook configuration updated successfully');

      // Step 2: Get current config
      const getResult = await server.tools.get_current_webhook_config.handler({});
      expect(getResult.content[0].text).toContain('Current Webhook Configuration');
      expect(getResult.content[0].text).toContain('https://test-webhook.com/endpoint');

      // Step 3: Test webhook
      mockedAxios.post.mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
      });

      const testResult = await server.tools.test_webhook.handler({
        url: 'https://test-webhook.com/endpoint',
        authToken: 'test-token',
      });

      expect(testResult.content[0].text).toContain('Webhook test completed');
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://test-webhook.com/endpoint',
        expect.objectContaining({
          from: '1234567890',
          name: 'Test User',
          message: 'This is a test message',
        }),
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token',
          },
        })
      );

      // Step 4: Disable webhook
      const disableResult = await server.tools.disable_webhook.handler({
        saveToFile: false,
      });

      expect(disableResult.content[0].text).toContain('Webhook has been disabled successfully');
    });

    it('should handle webhook test failures', async () => {
      mockedAxios.post.mockRejectedValueOnce(new Error('Network error'));

      const result = await server.tools.test_webhook.handler({
        url: 'https://invalid-webhook.com/endpoint',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Webhook test failed');
    });
  });

  describe('Webhook Filtering', () => {
    it('should configure webhook with different filter combinations', async () => {
      const testCases = [
        {
          name: 'Private messages only',
          filters: { allowPrivate: true, allowGroups: false },
        },
        {
          name: 'Group messages only',
          filters: { allowPrivate: false, allowGroups: true },
        },
        {
          name: 'Specific numbers only',
          filters: { 
            allowedNumbers: ['1234567890', '0987654321'],
            allowPrivate: true,
            allowGroups: true,
          },
        },
      ];

      for (const testCase of testCases) {
        const result = await server.tools.update_webhook_config.handler({
          url: 'https://test-webhook.com/endpoint',
          saveToFile: false,
          filters: testCase.filters,
        });

        expect(result.content[0].text).toContain('Webhook configuration updated successfully');
        expect(result.content[0].text).toContain(JSON.stringify(testCase.filters));
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid webhook URLs gracefully', async () => {
      const result = await server.tools.update_webhook_config.handler({
        url: 'invalid-url',
        saveToFile: false,
      });

      // Should still succeed in updating config (validation happens at webhook send time)
      expect(result.content[0].text).toContain('Webhook configuration updated successfully');
    });

    it('should handle file system errors', async () => {
      const mockFs = require('fs');
      mockFs.writeFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = await server.tools.update_webhook_config.handler({
        url: 'https://test-webhook.com/endpoint',
        saveToFile: true,
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('failed to save to custom path');
    });
  });
});
