import express, { Request, Response, Router } from 'express';
import { SessionManager } from './session-manager';
import logger from './logger';
import QRCode from 'qrcode';

export function createSessionRouter(sessionManager: SessionManager): Router {
  const router = express.Router();

  // Get all sessions
  router.get('/', async (_req: Request, res: Response) => {
    try {
      const sessions = sessionManager.listSessions();
      // Ensure we return an array
      const sessionsArray = Array.isArray(sessions) ? sessions : [];
      res.json(sessionsArray);
    } catch (error) {
      logger.error(`Error listing sessions: ${error}`);
      res.status(500).json({
        error: 'Failed to list sessions',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Get session info
  router.get('/:sessionId', async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const info = sessionManager.getSessionInfo(sessionId);
      
      if (!info) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }
      
      res.json(info);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get session info',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Create new session
  router.post('/', async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.body;
      
      if (!sessionId || typeof sessionId !== 'string') {
        res.status(400).json({ error: 'sessionId is required and must be a string' });
        return;
      }

      const info = await sessionManager.createSession(sessionId);
      res.status(201).json(info);
    } catch (error) {
      if (error instanceof Error && error.message.includes('already exists')) {
        res.status(409).json({ error: error.message });
      } else {
        res.status(500).json({
          error: 'Failed to create session',
          details: error instanceof Error ? error.message : String(error),
        });
      }
    }
  });

  // Delete session
  router.delete('/:sessionId', async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      await sessionManager.deleteSession(sessionId);
      res.json({ message: `Session ${sessionId} deleted successfully` });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to delete session',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Get QR code for session
  router.get('/:sessionId/qr', async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const info = sessionManager.getSessionInfo(sessionId);
      
      if (!info) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      if (!info.qrCode) {
        res.status(404).json({ error: 'QR code not available for this session' });
        return;
      }

      // Generate QR code as PNG
      const qrCodeDataUrl = await QRCode.toDataURL(info.qrCode);
      const base64Data = qrCodeDataUrl.replace(/^data:image\/png;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');

      res.setHeader('Content-Type', 'image/png');
      res.send(buffer);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to generate QR code',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return router;
}

