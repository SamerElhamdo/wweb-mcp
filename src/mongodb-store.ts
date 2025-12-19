import { MongoClient, Db, Collection } from 'mongodb';
import logger from './logger';

export interface SessionDocument {
  session: string;
  data: Buffer;
  createdAt: Date;
  updatedAt: Date;
}

export class MongoDBStore {
  private client: MongoClient;
  private db: Db;
  private collection: Collection<SessionDocument>;
  private connected: boolean = false;

  constructor(connectionString: string, dbName: string = 'whatsapp_sessions') {
    this.client = new MongoClient(connectionString);
    this.db = this.client.db(dbName);
    this.collection = this.db.collection<SessionDocument>('sessions');
  }

  async connect(): Promise<void> {
    if (this.connected) return;
    
    try {
      await this.client.connect();
      this.connected = true;
      
      // Create index on session field for faster lookups
      await this.collection.createIndex({ session: 1 }, { unique: true });
      
      logger.info('Connected to MongoDB successfully');
    } catch (error) {
      logger.error(`Failed to connect to MongoDB: ${error}`);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.connected) return;
    
    try {
      await this.client.close();
      this.connected = false;
      logger.info('Disconnected from MongoDB');
    } catch (error) {
      logger.error(`Failed to disconnect from MongoDB: ${error}`);
    }
  }

  async sessionExists({ session }: { session: string }): Promise<boolean> {
    try {
      const doc = await this.collection.findOne({ session });
      return doc !== null;
    } catch (error) {
      logger.error(`Error checking session existence: ${error}`);
      return false;
    }
  }

  async delete({ session }: { session: string }): Promise<void> {
    try {
      await this.collection.deleteOne({ session });
      logger.info(`Deleted session: ${session}`);
    } catch (error) {
      logger.error(`Error deleting session: ${error}`);
      throw error;
    }
  }

  async save({ session, path: sessionPath }: { session: string; path?: string }): Promise<void> {
    try {
      if (!sessionPath) {
        // RemoteAuth may call save without path, just return
        return;
      }
      
      const fs = require('fs');
      if (!fs.existsSync(sessionPath)) {
        throw new Error(`Session path does not exist: ${sessionPath}`);
      }

      // Read the session directory and create a zip
      const archiver = require('archiver');
      
      const archive = archiver('zip', { zlib: { level: 9 } });
      const chunks: Buffer[] = [];

      archive.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });

      return new Promise((resolve, reject) => {
        archive.on('end', async () => {
          try {
            const buffer = Buffer.concat(chunks);
            const doc: SessionDocument = {
              session,
              data: buffer,
              updatedAt: new Date(),
              createdAt: new Date(),
            };

            await this.collection.replaceOne(
              { session },
              doc,
              { upsert: true }
            );
            
            logger.info(`Saved session to MongoDB: ${session}`);
            resolve();
          } catch (error) {
            reject(error);
          }
        });

        archive.on('error', reject);
        archive.directory(sessionPath, false);
        archive.finalize();
      });
    } catch (error) {
      logger.error(`Error saving session: ${error}`);
      throw error;
    }
  }

  async extract({ session, path: extractPath }: { session: string; path: string }): Promise<void> {
    try {
      const doc = await this.collection.findOne({ session });
      if (!doc) {
        throw new Error(`Session not found: ${session}`);
      }

      const fs = require('fs');
      const unzipper = require('unzipper');
      const path = require('path');

      // Ensure extract directory exists
      if (!fs.existsSync(extractPath)) {
        fs.mkdirSync(extractPath, { recursive: true });
      }

      // Extract zip data
      const stream = require('stream');
      await new Promise<void>((resolve, reject) => {
        const bufferStream = new stream.PassThrough();
        bufferStream.end(doc.data);
        
        bufferStream
          .pipe(unzipper.Extract({ path: extractPath }))
          .on('close', () => resolve())
          .on('error', reject);
      });

      logger.info(`Extracted session from MongoDB: ${session} to ${extractPath}`);
    } catch (error) {
      logger.error(`Error extracting session: ${error}`);
      throw error;
    }
  }

  async listSessions(): Promise<string[]> {
    try {
      const docs = await this.collection.find({}).project({ session: 1 }).toArray();
      return docs.map((doc: any) => doc.session as string).filter((s: string | undefined): s is string => !!s);
    } catch (error) {
      logger.error(`Error listing sessions: ${error}`);
      return [];
    }
  }

  async getSessionInfo(session: string): Promise<SessionDocument | null> {
    try {
      return await this.collection.findOne({ session });
    } catch (error) {
      logger.error(`Error getting session info: ${error}`);
      return null;
    }
  }
}

