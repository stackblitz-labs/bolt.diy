import fs from 'fs/promises';
import path from 'path';
import { generateUserId, hashPassword } from './crypto';

const USERS_DIR = path.join(process.cwd(), '.users');
const USERS_INDEX_FILE = path.join(USERS_DIR, 'users.json');
const USER_DATA_DIR = path.join(USERS_DIR, 'data');

export interface UserProfile {
  id: string;
  username: string;
  firstName: string;
  passwordHash: string;
  avatar?: string;
  createdAt: string;
  lastLogin?: string;
  preferences: UserPreferences;
}

export interface UserPreferences {
  theme: 'light' | 'dark';
  deploySettings: {
    netlify?: any;
    vercel?: any;
  };
  githubSettings?: any;
  workspaceConfig: any;
}

export interface SecurityLog {
  timestamp: string;
  userId?: string;
  username?: string;
  action: 'login' | 'logout' | 'signup' | 'delete' | 'error' | 'failed_login';
  details: string;
  ip?: string;
}

/**
 * Initialize the user storage system
 */
export async function initializeUserStorage(): Promise<void> {
  try {
    // Create directories if they don't exist
    await fs.mkdir(USERS_DIR, { recursive: true });
    await fs.mkdir(USER_DATA_DIR, { recursive: true });

    // Create users index if it doesn't exist
    try {
      await fs.access(USERS_INDEX_FILE);
    } catch {
      await fs.writeFile(USERS_INDEX_FILE, JSON.stringify({ users: [] }, null, 2));
    }
  } catch (error) {
    console.error('Failed to initialize user storage:', error);
    throw error;
  }
}

/**
 * Get all users (without passwords)
 */
export async function getAllUsers(): Promise<Omit<UserProfile, 'passwordHash'>[]> {
  try {
    await initializeUserStorage();

    const data = await fs.readFile(USERS_INDEX_FILE, 'utf-8');
    const { users } = JSON.parse(data) as { users: UserProfile[] };

    return users.map(({ passwordHash, ...user }) => user);
  } catch (error) {
    console.error('Failed to get users:', error);
    return [];
  }
}

/**
 * Get a user by username
 */
export async function getUserByUsername(username: string): Promise<UserProfile | null> {
  try {
    await initializeUserStorage();

    const data = await fs.readFile(USERS_INDEX_FILE, 'utf-8');
    const { users } = JSON.parse(data) as { users: UserProfile[] };

    return users.find((u) => u.username === username) || null;
  } catch (error) {
    console.error('Failed to get user:', error);
    return null;
  }
}

/**
 * Get a user by ID
 */
export async function getUserById(id: string): Promise<UserProfile | null> {
  try {
    await initializeUserStorage();

    const data = await fs.readFile(USERS_INDEX_FILE, 'utf-8');
    const { users } = JSON.parse(data) as { users: UserProfile[] };

    return users.find((u) => u.id === id) || null;
  } catch (error) {
    console.error('Failed to get user:', error);
    return null;
  }
}

/**
 * Create a new user
 */
export async function createUser(
  username: string,
  password: string,
  firstName: string,
  avatar?: string,
): Promise<UserProfile | null> {
  try {
    await initializeUserStorage();

    // Check if username already exists
    const existingUser = await getUserByUsername(username);

    if (existingUser) {
      throw new Error('Username already exists');
    }

    // Create new user
    const newUser: UserProfile = {
      id: generateUserId(),
      username,
      firstName,
      passwordHash: await hashPassword(password),
      avatar,
      createdAt: new Date().toISOString(),
      preferences: {
        theme: 'dark',
        deploySettings: {},
        workspaceConfig: {},
      },
    };

    // Load existing users
    const data = await fs.readFile(USERS_INDEX_FILE, 'utf-8');
    const { users } = JSON.parse(data) as { users: UserProfile[] };

    // Add new user
    users.push(newUser);

    // Save updated users
    await fs.writeFile(USERS_INDEX_FILE, JSON.stringify({ users }, null, 2));

    // Create user data directory
    const userDataDir = path.join(USER_DATA_DIR, newUser.id);
    await fs.mkdir(userDataDir, { recursive: true });

    // Log the signup
    await logSecurityEvent({
      timestamp: new Date().toISOString(),
      userId: newUser.id,
      username: newUser.username,
      action: 'signup',
      details: `User ${newUser.username} created successfully`,
    });

    return newUser;
  } catch (error) {
    console.error('Failed to create user:', error);
    await logSecurityEvent({
      timestamp: new Date().toISOString(),
      action: 'error',
      details: `Failed to create user ${username}: ${error}`,
    });
    throw error;
  }
}

/**
 * Update user profile
 */
export async function updateUser(userId: string, updates: Partial<UserProfile>): Promise<boolean> {
  try {
    await initializeUserStorage();

    const data = await fs.readFile(USERS_INDEX_FILE, 'utf-8');
    const { users } = JSON.parse(data) as { users: UserProfile[] };

    const userIndex = users.findIndex((u) => u.id === userId);

    if (userIndex === -1) {
      return false;
    }

    // Update user (excluding certain fields)
    const { id, username, passwordHash, ...safeUpdates } = updates;
    users[userIndex] = {
      ...users[userIndex],
      ...safeUpdates,
    };

    // Save updated users
    await fs.writeFile(USERS_INDEX_FILE, JSON.stringify({ users }, null, 2));

    return true;
  } catch (error) {
    console.error('Failed to update user:', error);
    return false;
  }
}

/**
 * Update user's last login time
 */
export async function updateLastLogin(userId: string): Promise<void> {
  await updateUser(userId, { lastLogin: new Date().toISOString() });
}

/**
 * Delete a user
 */
export async function deleteUser(userId: string): Promise<boolean> {
  try {
    await initializeUserStorage();

    const data = await fs.readFile(USERS_INDEX_FILE, 'utf-8');
    const { users } = JSON.parse(data) as { users: UserProfile[] };

    const userIndex = users.findIndex((u) => u.id === userId);

    if (userIndex === -1) {
      return false;
    }

    const deletedUser = users[userIndex];

    // Remove user from list
    users.splice(userIndex, 1);

    // Save updated users
    await fs.writeFile(USERS_INDEX_FILE, JSON.stringify({ users }, null, 2));

    // Delete user data directory
    const userDataDir = path.join(USER_DATA_DIR, userId);

    try {
      await fs.rm(userDataDir, { recursive: true, force: true });
    } catch (error) {
      console.warn(`Failed to delete user data directory: ${error}`);
    }

    // Log the deletion
    await logSecurityEvent({
      timestamp: new Date().toISOString(),
      userId,
      username: deletedUser.username,
      action: 'delete',
      details: `User ${deletedUser.username} deleted`,
    });

    return true;
  } catch (error) {
    console.error('Failed to delete user:', error);
    return false;
  }
}

/**
 * Save user-specific data
 */
export async function saveUserData(userId: string, key: string, data: any): Promise<void> {
  try {
    const userDataDir = path.join(USER_DATA_DIR, userId);
    await fs.mkdir(userDataDir, { recursive: true });

    const filePath = path.join(userDataDir, `${key}.json`);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error(`Failed to save user data for ${userId}:`, error);
    throw error;
  }
}

/**
 * Load user-specific data
 */
export async function loadUserData(userId: string, key: string): Promise<any | null> {
  try {
    const filePath = path.join(USER_DATA_DIR, userId, `${key}.json`);
    const data = await fs.readFile(filePath, 'utf-8');

    return JSON.parse(data);
  } catch {
    return null;
  }
}

/**
 * Log security events
 */
export async function logSecurityEvent(event: SecurityLog): Promise<void> {
  try {
    const logFile = path.join(USERS_DIR, 'security.log');
    const logEntry = `${JSON.stringify(event)}\n`;

    await fs.appendFile(logFile, logEntry);
  } catch (error) {
    console.error('Failed to log security event:', error);
  }
}

/**
 * Get security logs
 */
export async function getSecurityLogs(limit: number = 100): Promise<SecurityLog[]> {
  try {
    const logFile = path.join(USERS_DIR, 'security.log');
    const data = await fs.readFile(logFile, 'utf-8');

    const logs = data
      .trim()
      .split('\n')
      .filter((line) => line)
      .map((line) => {
        try {
          return JSON.parse(line) as SecurityLog;
        } catch {
          return null;
        }
      })
      .filter(Boolean) as SecurityLog[];

    return logs.slice(-limit).reverse();
  } catch {
    return [];
  }
}
