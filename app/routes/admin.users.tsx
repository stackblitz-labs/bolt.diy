import { useState, useEffect } from 'react';
import { useNavigate } from '@remix-run/react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@nanostores/react';
import { authStore } from '~/lib/stores/auth';
import { ProtectedRoute } from '~/components/auth/ProtectedRoute';
import { classNames } from '~/utils/classNames';

interface User {
  id: string;
  username: string;
  firstName: string;
  avatar?: string;
  createdAt: string;
  lastLogin?: string;
}

export default function UserManagement() {
  const navigate = useNavigate();
  const authState = useStore(authStore);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users', {
        headers: {
          Authorization: `Bearer ${authState.token}`,
        },
      });

      if (response.ok) {
        const data = (await response.json()) as { users: User[] };
        setUsers(data.users);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) {
      return;
    }

    setDeleting(true);

    try {
      const response = await fetch(`/api/users/${selectedUser.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${authState.token}`,
        },
      });

      if (response.ok) {
        setUsers(users.filter((u) => u.id !== selectedUser.id));
        setShowDeleteModal(false);
        setSelectedUser(null);
      }
    } catch (error) {
      console.error('Failed to delete user:', error);
    } finally {
      setDeleting(false);
    }
  };

  const filteredUsers = users.filter(
    (user) =>
      user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.firstName.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-bolt-elements-background-depth-1">
        {/* Header */}
        <header className="border-b border-bolt-elements-borderColor bg-bolt-elements-background-depth-2">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => navigate('/')}
                  className="p-2 rounded-lg hover:bg-bolt-elements-background-depth-3 transition-colors"
                >
                  <span className="i-ph:arrow-left text-xl text-bolt-elements-textPrimary" />
                </button>
                <div>
                  <h1 className="text-xl font-bold text-bolt-elements-textPrimary">User Management</h1>
                  <p className="text-sm text-bolt-elements-textSecondary">Manage system users</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={classNames(
                      'w-64 px-4 py-2 pl-10 rounded-lg',
                      'bg-bolt-elements-background-depth-1',
                      'border border-bolt-elements-borderColor',
                      'text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary',
                      'focus:outline-none focus:ring-2 focus:ring-accent-500',
                    )}
                  />
                  <span className="absolute left-3 top-2.5 i-ph:magnifying-glass text-bolt-elements-textTertiary" />
                </div>

                <button
                  onClick={() => navigate('/auth')}
                  className={classNames(
                    'px-4 py-2 rounded-lg',
                    'bg-accent-500 text-white',
                    'hover:bg-accent-600',
                    'transition-colors',
                    'flex items-center gap-2',
                  )}
                >
                  <span className="i-ph:plus text-lg" />
                  <span>Add User</span>
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* User Stats */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-bolt-elements-background-depth-2 rounded-lg p-4 border border-bolt-elements-borderColor">
              <p className="text-sm text-bolt-elements-textSecondary mb-1">Total Users</p>
              <p className="text-2xl font-bold text-bolt-elements-textPrimary">{users.length}</p>
            </div>
            <div className="bg-bolt-elements-background-depth-2 rounded-lg p-4 border border-bolt-elements-borderColor">
              <p className="text-sm text-bolt-elements-textSecondary mb-1">Active Today</p>
              <p className="text-2xl font-bold text-green-500">
                {
                  users.filter((u) => {
                    if (!u.lastLogin) {
                      return false;
                    }

                    const lastLogin = new Date(u.lastLogin);
                    const today = new Date();

                    return lastLogin.toDateString() === today.toDateString();
                  }).length
                }
              </p>
            </div>
            <div className="bg-bolt-elements-background-depth-2 rounded-lg p-4 border border-bolt-elements-borderColor">
              <p className="text-sm text-bolt-elements-textSecondary mb-1">New This Week</p>
              <p className="text-2xl font-bold text-blue-500">
                {
                  users.filter((u) => {
                    const created = new Date(u.createdAt);
                    const weekAgo = new Date();
                    weekAgo.setDate(weekAgo.getDate() - 7);

                    return created > weekAgo;
                  }).length
                }
              </p>
            </div>
            <div className="bg-bolt-elements-background-depth-2 rounded-lg p-4 border border-bolt-elements-borderColor">
              <p className="text-sm text-bolt-elements-textSecondary mb-1">Storage Used</p>
              <p className="text-2xl font-bold text-bolt-elements-textPrimary">0 MB</p>
            </div>
          </div>
        </div>

        {/* User List */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
          {loading ? (
            <div className="flex justify-center py-12">
              <span className="i-svg-spinners:3-dots-scale text-2xl text-bolt-elements-textPrimary" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-12">
              <span className="i-ph:users text-4xl text-bolt-elements-textTertiary mb-4" />
              <p className="text-bolt-elements-textSecondary">
                {searchQuery ? 'No users found matching your search' : 'No users yet'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <AnimatePresence>
                {filteredUsers.map((user, index) => (
                  <motion.div
                    key={user.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    className={classNames(
                      'bg-bolt-elements-background-depth-2 rounded-lg p-6',
                      'border border-bolt-elements-borderColor',
                      'hover:shadow-lg transition-all',
                      user.id === authState.user?.id ? 'ring-2 ring-accent-500' : '',
                    )}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-bolt-elements-background-depth-3 flex items-center justify-center overflow-hidden border border-bolt-elements-borderColor">
                          {user.avatar ? (
                            <img src={user.avatar} alt={user.firstName} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-lg font-medium text-bolt-elements-textPrimary">
                              {user.firstName[0].toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-bolt-elements-textPrimary">
                            {user.firstName}
                            {user.id === authState.user?.id && (
                              <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-accent-500/20 text-accent-500">
                                You
                              </span>
                            )}
                          </p>
                          <p className="text-sm text-bolt-elements-textSecondary">@{user.username}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          className="p-1 rounded hover:bg-bolt-elements-background-depth-3 transition-colors"
                          title="Edit user"
                        >
                          <span className="i-ph:pencil text-bolt-elements-textSecondary" />
                        </button>
                        {user.id !== authState.user?.id && (
                          <button
                            onClick={() => {
                              setSelectedUser(user);
                              setShowDeleteModal(true);
                            }}
                            className="p-1 rounded hover:bg-red-500/10 transition-colors"
                            title="Delete user"
                          >
                            <span className="i-ph:trash text-red-500" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-bolt-elements-textSecondary">
                        <span className="i-ph:calendar-blank" />
                        <span>Joined {new Date(user.createdAt).toLocaleDateString()}</span>
                      </div>
                      {user.lastLogin && (
                        <div className="flex items-center gap-2 text-bolt-elements-textSecondary">
                          <span className="i-ph:clock" />
                          <span>Last active {new Date(user.lastLogin).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Delete Confirmation Modal */}
        <AnimatePresence>
          {showDeleteModal && selectedUser && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              onClick={() => !deleting && setShowDeleteModal(false)}
            >
              <motion.div
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.95 }}
                className="bg-bolt-elements-background-depth-2 rounded-lg p-6 max-w-md w-full border border-bolt-elements-borderColor"
                onClick={(e) => e.stopPropagation()}
              >
                <h2 className="text-xl font-bold text-bolt-elements-textPrimary mb-2">Delete User</h2>
                <p className="text-bolt-elements-textSecondary mb-6">
                  Are you sure you want to delete{' '}
                  <span className="font-medium text-bolt-elements-textPrimary">@{selectedUser.username}</span>? This
                  action cannot be undone and will permanently remove all user data.
                </p>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    disabled={deleting}
                    className={classNames(
                      'flex-1 px-4 py-2 rounded-lg',
                      'border border-bolt-elements-borderColor',
                      'text-bolt-elements-textPrimary',
                      'hover:bg-bolt-elements-background-depth-3',
                      'disabled:opacity-50',
                      'transition-colors',
                    )}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteUser}
                    disabled={deleting}
                    className={classNames(
                      'flex-1 px-4 py-2 rounded-lg',
                      'bg-red-500 text-white',
                      'hover:bg-red-600',
                      'disabled:opacity-50',
                      'transition-colors',
                      'flex items-center justify-center gap-2',
                    )}
                  >
                    {deleting ? (
                      <>
                        <span className="i-svg-spinners:3-dots-scale" />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <span className="i-ph:trash" />
                        Delete User
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ProtectedRoute>
  );
}
