import { IncomingMessage, ServerResponse } from 'http';
import crypto from 'crypto';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { Market, Position, Trade, User } from '../types';
import { dbQuery, getSupabaseClient } from './db';
import { logger } from './logger';

export interface SseClientConnection {
  id: string;
  res: ServerResponse;
  userId?: string;
  role?: 'user' | 'admin';
  email?: string;
  connectedAt: number;
  lastPing: number;
}

export class RealtimeService {
  private connections = new Map<string, SseClientConnection>();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  // Supabase Realtime Channels
  private supabasePublicChannel: RealtimeChannel | null = null;
  private supabaseAdminChannel: RealtimeChannel | null = null;
  private supabaseUserChannels = new Map<string, { channel: RealtimeChannel; lastUsed: number }>();
  private isSupabaseInitialized = false;

  constructor() {
    this.startHeartbeat();
    // Delay Supabase channel bootstrap until runtime credentials are ready
    setTimeout(() => {
      this.initSupabaseChannels();
    }, 1000);
  }

  private initSupabaseChannels() {
    if (this.isSupabaseInitialized) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;

    try {
      if (!this.supabasePublicChannel) {
        this.supabasePublicChannel = supabase.channel('public:markets');
        this.supabasePublicChannel.subscribe((status) => {
          logger.info('Realtime', `Supabase Realtime public channel status: ${status}`);
        });
      }

      if (!this.supabaseAdminChannel) {
        this.supabaseAdminChannel = supabase.channel('admin:updates');
        this.supabaseAdminChannel.subscribe((status) => {
          logger.info('Realtime', `Supabase Realtime admin channel status: ${status}`);
        });
      }

      this.isSupabaseInitialized = true;
    } catch (err: any) {
      logger.debug('Realtime', `Supabase channel init notice: ${err.message}`);
    }
  }

  private startHeartbeat() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      for (const [id, conn] of this.connections.entries()) {
        try {
          conn.res.write(': heartbeat\n\n');
          if (typeof (conn.res as any).flush === 'function') {
            (conn.res as any).flush();
          }
          conn.lastPing = now;
        } catch {
          this.removeConnection(id);
        }
      }

      // Cleanup idle user channels (> 15 minutes)
      const idleCutoff = now - 15 * 60 * 1000;
      for (const [userId, entry] of this.supabaseUserChannels.entries()) {
        if (entry.lastUsed < idleCutoff) {
          entry.channel.unsubscribe().catch(() => {});
          this.supabaseUserChannels.delete(userId);
        }
      }
    }, 5000);

    if (this.heartbeatInterval && typeof (this.heartbeatInterval as any).unref === 'function') {
      (this.heartbeatInterval as any).unref();
    }
  }

  public getConnectionCount(): number {
    return this.connections.size;
  }

  public async handleSseConnection(req: IncomingMessage, res: ServerResponse, token?: string): Promise<void> {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform, no-store',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    });

    if (typeof (res as any).flushHeaders === 'function') {
      (res as any).flushHeaders();
    }

    res.write(`: ${' '.repeat(4096)}\n\n`);
    res.write('retry: 2000\n\n');
    if (typeof (res as any).flush === 'function') {
      (res as any).flush();
    }

    let verifiedUser: User | null = null;
    if (token) {
      try {
        const uRes = await dbQuery(
          `SELECT u.id, u.name, u.email, u.role, u.virtual_balance, u.avatar
           FROM sessions s JOIN users u ON s.user_id = u.id
           WHERE s.token = $1 AND s.expires_at > NOW();`,
          [token]
        );
        if (uRes.rowCount > 0) {
          const r = uRes.rows[0];
          verifiedUser = {
            id: r.id,
            name: r.name,
            email: r.email,
            role: r.role,
            virtualBalance: Number(r.virtual_balance),
            avatar: r.avatar || undefined,
          };
        }
      } catch {}
    }

    const connId = `conn-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const conn: SseClientConnection = {
      id: connId,
      res,
      userId: verifiedUser?.id,
      role: verifiedUser?.role,
      email: verifiedUser?.email,
      connectedAt: Date.now(),
      lastPing: Date.now(),
    };

    this.connections.set(connId, conn);

    this.sendSseEvent(res, 'connected', {
      status: 'connected',
      connectionId: connId,
      userId: verifiedUser?.id,
      role: verifiedUser?.role,
      serverTime: new Date().toISOString(),
    });

    req.on('close', () => {
      this.removeConnection(connId);
    });

    req.on('error', () => {
      this.removeConnection(connId);
    });
  }

  private removeConnection(id: string): void {
    const conn = this.connections.get(id);
    if (conn) {
      try {
        conn.res.end();
      } catch {}
      this.connections.delete(id);
    }
  }

  private sendSseEvent(res: ServerResponse, event: string, data: any): void {
    try {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      if (typeof (res as any).flush === 'function') {
        (res as any).flush();
      }
    } catch {}
  }

  /**
   * Broadcast public event to ALL active client connections via:
   * 1. Supabase Realtime channel `public:markets`
   * 2. Local fallback SSE stream
   */
  public async broadcast(event: string, data: any): Promise<void> {
    // 1. Broadcast to Supabase Realtime WebSocket channel
    try {
      const supabase = getSupabaseClient();
      if (supabase) {
        this.initSupabaseChannels();
        if (this.supabasePublicChannel) {
          await this.supabasePublicChannel.send({
            type: 'broadcast',
            event,
            payload: data,
          });
        }
      }
    } catch (err: any) {
      logger.debug('Realtime', `Supabase broadcast exception: ${err.message}`);
    }

    // 2. Local SSE fallback
    for (const [id, conn] of this.connections.entries()) {
      try {
        this.sendSseEvent(conn.res, event, data);
      } catch {
        this.removeConnection(id);
      }
    }
  }

  /**
   * Send private event ONLY to connections of a specific authenticated user via:
   * 1. Supabase Realtime private channel `user:${userId}`
   * 2. Local fallback SSE stream
   */
  public async sendToUser(userId: string, event: string, data: any): Promise<void> {
    if (!userId) return;

    // 1. Supabase Realtime private channel
    try {
      const supabase = getSupabaseClient();
      if (supabase) {
        const channelName = `user:${userId}`;
        let entry = this.supabaseUserChannels.get(userId);
        if (!entry) {
          const ch = supabase.channel(channelName);
          ch.subscribe();
          entry = { channel: ch, lastUsed: Date.now() };
          this.supabaseUserChannels.set(userId, entry);
        }
        entry.lastUsed = Date.now();
        await entry.channel.send({
          type: 'broadcast',
          event,
          payload: data,
        });
      }
    } catch (err: any) {
      logger.debug('Realtime', `Supabase sendToUser exception: ${err.message}`);
    }

    // 2. Local SSE fallback
    for (const [id, conn] of this.connections.entries()) {
      if (conn.userId === userId) {
        try {
          this.sendSseEvent(conn.res, event, data);
        } catch {
          this.removeConnection(id);
        }
      }
    }
  }

  public emitToUser(userId: string, event: string, data: any): void {
    this.sendToUser(userId, event, data).catch(() => {});
  }

  /**
   * Broadcast admin event ONLY to active admin sessions via:
   * 1. Supabase Realtime admin channel `admin:updates`
   * 2. Local fallback SSE stream
   */
  public async broadcastToAdmins(event: string, data: any): Promise<void> {
    // 1. Supabase Realtime admin channel
    try {
      const supabase = getSupabaseClient();
      if (supabase) {
        this.initSupabaseChannels();
        if (this.supabaseAdminChannel) {
          await this.supabaseAdminChannel.send({
            type: 'broadcast',
            event,
            payload: data,
          });
        }
      }
    } catch (err: any) {
      logger.debug('Realtime', `Supabase broadcastToAdmins exception: ${err.message}`);
    }

    // 2. Local SSE fallback
    for (const [id, conn] of this.connections.entries()) {
      if (conn.role === 'admin') {
        try {
          this.sendSseEvent(conn.res, event, data);
        } catch {
          this.removeConnection(id);
        }
      }
    }
  }

  public getStats() {
    return {
      totalSseConnections: this.connections.size,
      authenticatedUsers: Array.from(this.connections.values()).filter((c) => !!c.userId).length,
      adminConnections: Array.from(this.connections.values()).filter((c) => c.role === 'admin').length,
      supabaseRealtimeActive: this.isSupabaseInitialized,
      activeUserChannels: this.supabaseUserChannels.size,
    };
  }
}

export const realtimeService = new RealtimeService();
