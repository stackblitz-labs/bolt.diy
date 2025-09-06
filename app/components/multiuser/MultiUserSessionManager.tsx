import React, { useState, useEffect } from 'react';
import { classNames } from '~/utils/classNames';
import { Dialog } from '~/components/ui/Dialog';
import * as RadixDialog from '@radix-ui/react-dialog';
import { Button } from '~/components/ui/Button';
import { toast } from 'react-toastify';
import Cookies from 'js-cookie';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'developer' | 'viewer' | 'guest';
  status: 'active' | 'idle' | 'offline';
  lastActivity: string;
  avatar?: string;
}

interface Session {
  userId: string;
  sessionId: string;
  startTime: string;
  lastActivity: string;
  ipAddress: string;
  device: string;
}

export const MultiUserSessionManager: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeUsers, setActiveUsers] = useState<User[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'developer' | 'viewer'>('developer');

  useEffect(() => {
    loadSessionData();

    const interval = setInterval(loadSessionData, 5000);

    // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const loadSessionData = async () => {
    try {
      // Get current user
      const token = Cookies.get('auth_token');

      if (token) {
        const userResponse = await fetch('/api/auth/verify', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (userResponse.ok) {
          const userData = await userResponse.json();
          setCurrentUser(userData as User);
        }
      }

      // Get active users (mock data for demo)
      const mockUsers: User[] = [
        {
          id: '1',
          email: 'admin@example.com',
          name: 'Admin User',
          role: 'admin',
          status: 'active',
          lastActivity: new Date().toISOString(),
        },
        {
          id: '2',
          email: 'dev@example.com',
          name: 'Developer',
          role: 'developer',
          status: 'idle',
          lastActivity: new Date(Date.now() - 5 * 60000).toISOString(),
        },
      ];
      setActiveUsers(mockUsers);

      // Get active sessions (mock data for demo)
      const mockSessions: Session[] = [
        {
          userId: '1',
          sessionId: 'session-1',
          startTime: new Date(Date.now() - 30 * 60000).toISOString(),
          lastActivity: new Date().toISOString(),
          ipAddress: '192.168.1.1',
          device: 'Chrome on Windows',
        },
        {
          userId: '2',
          sessionId: 'session-2',
          startTime: new Date(Date.now() - 60 * 60000).toISOString(),
          lastActivity: new Date(Date.now() - 5 * 60000).toISOString(),
          ipAddress: '192.168.1.2',
          device: 'Safari on Mac',
        },
      ];
      setSessions(mockSessions);
    } catch (error) {
      console.error('Failed to load session data:', error);
    }
  };

  const handleInviteUser = async () => {
    if (!inviteEmail.trim()) {
      toast.error('Please enter an email address');
      return;
    }

    try {
      // Send invitation
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail,
          role: inviteRole,
          action: 'invite',
        }),
      });

      if (response.ok) {
        toast.success(`Invitation sent to ${inviteEmail}`);
        setInviteEmail('');
      } else {
        toast.error('Failed to send invitation');
      }
    } catch (error) {
      console.error('Invite error:', error);
      toast.error('Failed to send invitation');
    }
  };

  const handleRemoveUser = async (userId: string) => {
    if (!window.confirm('Are you sure you want to remove this user?')) {
      return;
    }

    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('User removed successfully');
        loadSessionData();
      } else {
        toast.error('Failed to remove user');
      }
    } catch (error) {
      console.error('Remove user error:', error);
      toast.error('Failed to remove user');
    }
  };

  /**
   * const handleTerminateSession = async (_sessionId: string) => {
   *   if (!window.confirm('Are you sure you want to terminate this session?')) {
   *     return;
   *   }
   *
   *   try {
   *     // Terminate session
   *     toast.success('Session terminated');
   *     loadSessionData();
   *   } catch (error) {
   *     console.error('Terminate session error:', error);
   *     toast.error('Failed to terminate session');
   *   }
   * };
   */

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'developer':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'viewer':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'guest':
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
      default:
        return 'bg-bolt-elements-background-depth-2 text-bolt-elements-textSecondary';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return 'i-ph:circle-fill text-green-400';
      case 'idle':
        return 'i-ph:circle-fill text-yellow-400';
      case 'offline':
        return 'i-ph:circle-fill text-gray-400';
      default:
        return 'i-ph:circle text-gray-400';
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diff < 60) {
      return 'Just now';
    }

    if (diff < 3600) {
      return `${Math.floor(diff / 60)} min ago`;
    }

    if (diff < 86400) {
      return `${Math.floor(diff / 3600)} hours ago`;
    }

    return `${Math.floor(diff / 86400)} days ago`;
  };

  const multiUserEnabled = localStorage.getItem('multiUserEnabled') === 'true';

  if (!multiUserEnabled) {
    return null;
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor hover:bg-bolt-elements-background-depth-2 transition-all"
        title="Manage Sessions"
      >
        <span className="i-ph:users-three text-sm text-bolt-elements-textSecondary" />
        <span className="text-xs font-medium text-bolt-elements-textPrimary">{activeUsers.length} Active</span>
      </button>

      {isOpen && (
        <RadixDialog.Root open={isOpen} onOpenChange={setIsOpen}>
          <Dialog className="max-w-4xl" onClose={() => setIsOpen(false)}>
            <div className="p-6">
              <h2 className="text-xl font-semibold text-bolt-elements-textPrimary mb-6">Multi-User Session Manager</h2>

              {/* Tabs */}
              <div className="flex gap-4 mb-6 border-b border-bolt-elements-borderColor">
                <button className="px-4 py-2 text-sm font-medium text-bolt-elements-textPrimary border-b-2 border-blue-500">
                  Active Users ({activeUsers.length})
                </button>
                <button className="px-4 py-2 text-sm font-medium text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary">
                  Sessions ({sessions.length})
                </button>
                <button className="px-4 py-2 text-sm font-medium text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary">
                  Invite Users
                </button>
              </div>

              {/* Active Users List */}
              <div className="space-y-3 mb-6">
                {activeUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-4 bg-bolt-elements-background-depth-2 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                        <span className="text-white font-semibold">{user.name.charAt(0).toUpperCase()}</span>
                      </div>

                      {/* User Info */}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-bolt-elements-textPrimary">{user.name}</span>
                          <span className={classNames('text-xs', getStatusIcon(user.status))} />
                          <span
                            className={classNames(
                              'px-2 py-0.5 text-xs font-medium rounded-full border',
                              getRoleBadgeColor(user.role),
                            )}
                          >
                            {user.role}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-bolt-elements-textSecondary">{user.email}</span>
                          <span className="text-xs text-bolt-elements-textTertiary">
                            Active {formatTimeAgo(user.lastActivity)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    {currentUser?.role === 'admin' && user.id !== currentUser.id && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleRemoveUser(user.id)}
                          className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                          title="Remove User"
                        >
                          <span className="i-ph:trash text-sm" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Invite User Section */}
              <div className="p-4 bg-bolt-elements-background-depth-2 rounded-lg">
                <h3 className="text-sm font-medium text-bolt-elements-textPrimary mb-3">Invite New User</h3>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="Enter email address"
                    className="flex-1 px-3 py-1.5 text-sm bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded-lg text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary"
                  />
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as 'developer' | 'viewer')}
                    className="px-3 py-1.5 text-sm bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded-lg text-bolt-elements-textPrimary"
                  >
                    <option value="developer">Developer</option>
                    <option value="viewer">Viewer</option>
                  </select>
                  <Button
                    variant="default"
                    onClick={handleInviteUser}
                    className="bg-gradient-to-r from-green-500 to-blue-500"
                  >
                    Send Invite
                  </Button>
                </div>
              </div>
            </div>
          </Dialog>
        </RadixDialog.Root>
      )}
    </>
  );
};
