import crypto from 'crypto';

export interface ActiveSession {
  sessionId: string;
  identityId: string;
  identityName: string;
  authenticatedAt: number;
  expiresAt: number;
  confidence: number;
  livenessMode: string;
}

export class SessionManager {
  private activeSession: ActiveSession | null = null;
  private sessionTtlMs: number = 5 * 60 * 1000; // 5 minutes default

  constructor(sessionTtlMs?: number) {
    if (sessionTtlMs) this.sessionTtlMs = sessionTtlMs;
  }

  public createSession(
    identityId: string,
    identityName: string,
    confidence: number,
    livenessMode: string
  ): ActiveSession {
    const now = Date.now();
    const session: ActiveSession = {
      sessionId: crypto.randomBytes(24).toString('hex'),
      identityId,
      identityName,
      authenticatedAt: now,
      expiresAt: now + this.sessionTtlMs,
      confidence,
      livenessMode,
    };
    this.activeSession = session;
    return session;
  }

  public getSession(): ActiveSession | null {
    if (!this.activeSession) return null;
    if (Date.now() > this.activeSession.expiresAt) {
      this.activeSession = null;
      return null;
    }
    return this.activeSession;
  }

  public refresh(): boolean {
    if (this.activeSession && Date.now() <= this.activeSession.expiresAt) {
      this.activeSession.expiresAt = Date.now() + this.sessionTtlMs;
      return true;
    }
    return false;
  }

  public revoke(): void {
    this.activeSession = null;
  }
}
