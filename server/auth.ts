import { Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import session from "express-session";
import { users, type User, type LoginCredentials, type RegisterCredentials } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

// Extend Express Request type to include session
interface AuthRequest extends Request {
  session: session.Session & Partial<session.SessionData> & {
    userId?: string;
    user?: User;
  };
  user?: User;
}

export class AuthService {
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  static async createUser(userData: RegisterCredentials): Promise<User> {
    const hashedPassword = await this.hashPassword(userData.password);
    
    const [user] = await db
      .insert(users)
      .values({
        username: userData.username,
        password: hashedPassword,
        role: userData.role,
      })
      .returning();
    
    return user;
  }

  static async authenticateUser(credentials: LoginCredentials): Promise<User | null> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, credentials.username));

    if (!user) {
      return null;
    }

    const isValid = await this.verifyPassword(credentials.password, user.password);
    if (!isValid) {
      return null;
    }

    // Update last login
    await db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, user.id));

    return user;
  }

  static async getUserById(id: string): Promise<User | null> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, id));

    return user || null;
  }

  static async getUserByUsername(username: string): Promise<User | null> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, username));

    return user || null;
  }
}

// Middleware to check if user is authenticated
export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.session.userId || !req.session.user) {
    return res.status(401).json({ error: "Authentication required" });
  }

  req.user = req.session.user;
  next();
}

// Middleware to check if user has admin role
export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.session.user || req.session.user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }

  req.user = req.session.user;
  next();
}

// Middleware to check if user has admin or guest role (basically any authenticated user)
export function requireUser(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.session.user || !["admin", "guest"].includes(req.session.user.role)) {
    return res.status(403).json({ error: "User access required" });
  }

  req.user = req.session.user;
  next();
}