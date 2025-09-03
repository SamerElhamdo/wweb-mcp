import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { updateWebhookConfig, getCurrentWebhookConfig } from '../../src/whatsapp-client';

// Mock fs module
jest.mock('fs');
const mockedFs = fs as jest.Mocked<typeof fs>;

describe('Webhook Management', () => {
  const testConfigPath = '/test/webhook.json';
  const testConfig = {
    url: 'https://test-webhook.com/endpoint',
    authToken: 'test-token',
    filters: {
      allowedNumbers: ['1234567890'],
      allowPrivate: true,
      allowGroups: false,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset global state
    (global as any).currentWebhookConfig = undefined;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('updateWebhookConfig', () => {
    it('should update webhook config in memory', () => {
      updateWebhookConfig(testConfig, false);
      
      const currentConfig = getCurrentWebhookConfig();
      expect(currentConfig).toEqual(testConfig);
    });

    it('should save config to file when saveToFile is true', () => {
      mockedFs.writeFileSync.mockImplementation(() => {});
      
      updateWebhookConfig(testConfig, true);
      
      expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
        expect.any(String),
        JSON.stringify(testConfig, null, 2)
      );
    });

    it('should not save to file when saveToFile is false', () => {
      mockedFs.writeFileSync.mockImplementation(() => {});
      
      updateWebhookConfig(testConfig, false);
      
      expect(mockedFs.writeFileSync).not.toHaveBeenCalled();
    });

    it('should handle file write errors gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockedFs.writeFileSync.mockImplementation(() => {
        throw new Error('Write failed');
      });
      
      updateWebhookConfig(testConfig, true);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to save webhook config to file')
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('getCurrentWebhookConfig', () => {
    it('should return undefined when no config is set', () => {
      const config = getCurrentWebhookConfig();
      expect(config).toBeUndefined();
    });

    it('should return current config when set', () => {
      updateWebhookConfig(testConfig, false);
      
      const config = getCurrentWebhookConfig();
      expect(config).toEqual(testConfig);
    });
  });

  describe('Webhook Config Structure', () => {
    it('should accept valid webhook config', () => {
      const validConfig = {
        url: 'https://example.com/webhook',
        authToken: 'secret-token',
        filters: {
          allowedNumbers: ['1234567890', '0987654321'],
          allowPrivate: true,
          allowGroups: true,
        },
      };

      expect(() => updateWebhookConfig(validConfig, false)).not.toThrow();
      
      const currentConfig = getCurrentWebhookConfig();
      expect(currentConfig).toEqual(validConfig);
    });

    it('should accept minimal webhook config', () => {
      const minimalConfig = {
        url: 'https://example.com/webhook',
      };

      expect(() => updateWebhookConfig(minimalConfig, false)).not.toThrow();
      
      const currentConfig = getCurrentWebhookConfig();
      expect(currentConfig).toEqual(minimalConfig);
    });
  });
});
