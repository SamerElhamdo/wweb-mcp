import { Client } from 'whatsapp-web.js';
import { MongoDBStore } from './mongodb-store';
import { createWhatsAppClient, WhatsAppConfig } from './whatsapp-client';
import logger from './logger';
import { EventEmitter } from 'events';

export interface SessionInfo {
  sessionId: string;
  status: 'initializing' | 'authenticating' | 'ready' | 'disconnected' | 'error';
  qrCode?: string;
  phoneNumber?: string;
  name?: string;
  error?: string;
  createdAt: Date;
  lastActivity: Date;
}

export class SessionManager extends EventEmitter {
  private sessions: Map<string, { client: Client; info: SessionInfo }> = new Map();
  private mongoStore: MongoDBStore | null = null;
  private mongoConnectionString: string;

  constructor(mongoConnectionString: string) {
    super();
    this.mongoConnectionString = mongoConnectionString;
  }

  async initialize(): Promise<void> {
    try {
      this.mongoStore = new MongoDBStore(this.mongoConnectionString);
      await this.mongoStore.connect();
      
      // Load existing sessions from MongoDB
      const existingSessions = await this.mongoStore.listSessions();
      logger.info(`Found ${existingSessions.length} existing sessions in MongoDB`);
      
      for (const sessionId of existingSessions) {
        await this.loadSession(sessionId);
      }
    } catch (error) {
      logger.error(`Failed to initialize SessionManager: ${error}`);
      throw error;
    }
  }

  async createSession(sessionId: string, config?: Partial<WhatsAppConfig>): Promise<SessionInfo> {
    if (this.sessions.has(sessionId)) {
      throw new Error(`Session ${sessionId} already exists`);
    }

    const sessionInfo: SessionInfo = {
      sessionId,
      status: 'initializing',
      createdAt: new Date(),
      lastActivity: new Date(),
    };

    this.sessions.set(sessionId, {
      client: null as any,
      info: sessionInfo,
    });

    try {
      const whatsappConfig: WhatsAppConfig = {
        authStrategy: 'mongodb',
        authDataPath: `.sessions/${sessionId}`,
        mongoConnectionString: this.mongoConnectionString,
        sessionId: sessionId,
        dockerContainer: process.env.DOCKER_CONTAINER === 'true',
        ...config,
      };

      const client = await createWhatsAppClient(whatsappConfig);
      
      // Set up event handlers
      client.on('qr', (qr: string) => {
        sessionInfo.status = 'authenticating';
        sessionInfo.qrCode = qr;
        sessionInfo.lastActivity = new Date();
        this.emit('qr', sessionId, qr);
        this.updateSession(sessionId, sessionInfo);
      });

      client.on('ready', async () => {
        sessionInfo.status = 'ready';
        const info = client.info;
        if (info) {
          sessionInfo.phoneNumber = info.wid.user;
          sessionInfo.name = info.pushname || info.wid.user;
        }
        sessionInfo.lastActivity = new Date();
        this.emit('ready', sessionId);
        this.updateSession(sessionId, sessionInfo);
      });

      client.on('authenticated', () => {
        sessionInfo.status = 'authenticating';
        sessionInfo.lastActivity = new Date();
        this.emit('authenticated', sessionId);
        this.updateSession(sessionId, sessionInfo);
      });

      client.on('auth_failure', (msg: string) => {
        sessionInfo.status = 'error';
        sessionInfo.error = msg;
        sessionInfo.lastActivity = new Date();
        this.emit('auth_failure', sessionId, msg);
        this.updateSession(sessionId, sessionInfo);
      });

      client.on('disconnected', (reason: string) => {
        sessionInfo.status = 'disconnected';
        sessionInfo.error = reason;
        sessionInfo.lastActivity = new Date();
        this.emit('disconnected', sessionId, reason);
        this.updateSession(sessionId, sessionInfo);
      });

      // Initialize the client before storing
      await client.initialize();
      
      this.sessions.set(sessionId, { client, info: sessionInfo });
      
      return sessionInfo;
    } catch (error) {
      sessionInfo.status = 'error';
      sessionInfo.error = error instanceof Error ? error.message : String(error);
      this.updateSession(sessionId, sessionInfo);
      throw error;
    }
  }

  async loadSession(sessionId: string): Promise<SessionInfo | null> {
    try {
      return await this.createSession(sessionId);
    } catch (error) {
      logger.error(`Failed to load session ${sessionId}: ${error}`);
      return null;
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      try {
        await session.client.destroy();
      } catch (error) {
        logger.error(`Error destroying client for session ${sessionId}: ${error}`);
      }
      this.sessions.delete(sessionId);
    }

    if (this.mongoStore) {
      try {
        await this.mongoStore.delete({ session: sessionId });
      } catch (error) {
        logger.error(`Error deleting session from MongoDB: ${error}`);
      }
    }
  }

  getSession(sessionId: string): Client | null {
    const session = this.sessions.get(sessionId);
    return session ? session.client : null;
  }

  getSessionInfo(sessionId: string): SessionInfo | null {
    const session = this.sessions.get(sessionId);
    return session ? session.info : null;
  }

  listSessions(): SessionInfo[] {
    return Array.from(this.sessions.values()).map(s => s.info);
  }

  private updateSession(sessionId: string, info: SessionInfo): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.info = info;
    }
  }

  async shutdown(): Promise<void> {
    // Destroy all clients
    for (const [sessionId, session] of this.sessions.entries()) {
      try {
        await session.client.destroy();
      } catch (error) {
        logger.error(`Error destroying client for session ${sessionId}: ${error}`);
      }
    }
    this.sessions.clear();

    // Disconnect from MongoDB
    if (this.mongoStore) {
      await this.mongoStore.disconnect();
    }
  }
}

