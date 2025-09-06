import { useState } from 'react';
import { useNavigate } from '@remix-run/react';
import { motion, AnimatePresence } from 'framer-motion';
import { login, signup } from '~/lib/stores/auth';
import { validatePassword } from '~/lib/utils/crypto';
import { classNames } from '~/utils/classNames';

export default function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    firstName: '',
    confirmPassword: '',
    rememberMe: false,
  });
  const [avatar, setAvatar] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));

    // Clear error for this field
    setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (file) {
      const reader = new FileReader();

      reader.onloadend = () => {
        setAvatar(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    try {
      if (mode === 'signup') {
        // Validate form
        const validationErrors: Record<string, string> = {};

        if (!formData.username) {
          validationErrors.username = 'Username is required';
        }

        if (!formData.firstName) {
          validationErrors.firstName = 'First name is required';
        }

        const passwordValidation = validatePassword(formData.password);

        if (!passwordValidation.valid) {
          validationErrors.password = passwordValidation.errors[0];
        }

        if (formData.password !== formData.confirmPassword) {
          validationErrors.confirmPassword = 'Passwords do not match';
        }

        if (Object.keys(validationErrors).length > 0) {
          setErrors(validationErrors);
          setLoading(false);

          return;
        }

        const result = await signup(formData.username, formData.password, formData.firstName, avatar);

        if (result.success) {
          navigate('/');
        } else {
          setErrors({ general: result.error || 'Signup failed' });
        }
      } else {
        const result = await login(formData.username, formData.password, formData.rememberMe);

        if (result.success) {
          navigate('/');
        } else {
          setErrors({ general: result.error || 'Invalid username or password' });
        }
      }
    } catch {
      setErrors({ general: 'An error occurred. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600">
        <div className="absolute inset-0 bg-black/30" />
        <motion.div
          className="absolute inset-0 opacity-30"
          animate={{
            background: [
              'radial-gradient(circle at 20% 80%, #3b82f6 0%, transparent 50%)',
              'radial-gradient(circle at 80% 20%, #a855f7 0%, transparent 50%)',
              'radial-gradient(circle at 40% 40%, #ec4899 0%, transparent 50%)',
              'radial-gradient(circle at 20% 80%, #3b82f6 0%, transparent 50%)',
            ],
          }}
          transition={{ duration: 10, repeat: Infinity }}
        />
      </div>

      {/* Logo and Title */}
      <div className="absolute top-8 left-8 z-20">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center">
            <span className="text-2xl">⚡</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">bolt.diy</h1>
            <p className="text-sm text-white/70">Multi-User Edition</p>
          </div>
        </motion.div>
      </div>

      {/* Auth Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 w-full max-w-md mx-4"
      >
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 overflow-hidden">
          {/* Tab Header */}
          <div className="flex relative bg-white/5">
            <button
              onClick={() => setMode('login')}
              className={classNames(
                'flex-1 py-4 text-center font-semibold transition-all',
                mode === 'login'
                  ? 'text-white bg-gradient-to-r from-blue-500/20 to-purple-600/20'
                  : 'text-white/70 hover:text-white hover:bg-white/5',
              )}
            >
              Sign In
            </button>
            <button
              onClick={() => setMode('signup')}
              className={classNames(
                'flex-1 py-4 text-center font-semibold transition-all',
                mode === 'signup'
                  ? 'text-white bg-gradient-to-r from-blue-500/20 to-purple-600/20'
                  : 'text-white/70 hover:text-white hover:bg-white/5',
              )}
            >
              Sign Up
            </button>

            {/* Sliding indicator */}
            <motion.div
              className="absolute bottom-0 h-1 bg-gradient-to-r from-blue-500 to-purple-600"
              initial={false}
              animate={{
                x: mode === 'login' ? '0%' : '100%',
                width: '50%',
              }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            />
          </div>

          {/* Form Content */}
          <div className="p-8">
            <AnimatePresence mode="wait">
              <motion.form
                key={mode}
                initial={{ opacity: 0, x: mode === 'login' ? -20 : 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: mode === 'login' ? 20 : -20 }}
                transition={{ duration: 0.3 }}
                onSubmit={handleSubmit}
                className="space-y-6"
              >
                {/* Avatar Upload (Signup only) */}
                {mode === 'signup' && (
                  <div className="flex justify-center">
                    <div className="relative">
                      <div className="w-24 h-24 rounded-full bg-white/20 backdrop-blur flex items-center justify-center overflow-hidden border-2 border-white/30">
                        {avatar ? (
                          <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-3xl text-white/50">👤</span>
                        )}
                      </div>
                      <label className="absolute bottom-0 right-0 w-8 h-8 bg-white/20 backdrop-blur rounded-full flex items-center justify-center cursor-pointer hover:bg-white/30 transition-colors border border-white/30">
                        <span className="text-sm">📷</span>
                        <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
                      </label>
                    </div>
                  </div>
                )}

                {/* First Name (Signup only) */}
                {mode === 'signup' && (
                  <div>
                    <label className="block text-sm font-medium text-white/80 mb-2">First Name</label>
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      className={classNames(
                        'w-full px-4 py-3 rounded-lg bg-white/10 backdrop-blur',
                        'border border-white/20 text-white placeholder-white/40',
                        'focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-transparent',
                        'transition-all',
                        errors.firstName && 'border-red-400',
                      )}
                      placeholder="Enter your first name"
                      required
                    />
                    {errors.firstName && <p className="mt-1 text-sm text-red-300">{errors.firstName}</p>}
                  </div>
                )}

                {/* Username */}
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">Username</label>
                  <input
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleInputChange}
                    className={classNames(
                      'w-full px-4 py-3 rounded-lg bg-white/10 backdrop-blur',
                      'border border-white/20 text-white placeholder-white/40',
                      'focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-transparent',
                      'transition-all',
                      errors.username && 'border-red-400',
                    )}
                    placeholder="Enter your username"
                    required
                  />
                  {errors.username && <p className="mt-1 text-sm text-red-300">{errors.username}</p>}
                </div>

                {/* Password */}
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">Password</label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className={classNames(
                      'w-full px-4 py-3 rounded-lg bg-white/10 backdrop-blur',
                      'border border-white/20 text-white placeholder-white/40',
                      'focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-transparent',
                      'transition-all',
                      errors.password && 'border-red-400',
                    )}
                    placeholder="Enter your password"
                    required
                  />
                  {errors.password && <p className="mt-1 text-sm text-red-300">{errors.password}</p>}
                  {mode === 'signup' && formData.password && (
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center gap-2">
                        <div
                          className={classNames(
                            'w-2 h-2 rounded-full',
                            formData.password.length >= 8 ? 'bg-green-400' : 'bg-white/30',
                          )}
                        />
                        <span className="text-xs text-white/60">At least 8 characters</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div
                          className={classNames(
                            'w-2 h-2 rounded-full',
                            /[A-Z]/.test(formData.password) ? 'bg-green-400' : 'bg-white/30',
                          )}
                        />
                        <span className="text-xs text-white/60">One uppercase letter</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div
                          className={classNames(
                            'w-2 h-2 rounded-full',
                            /[a-z]/.test(formData.password) ? 'bg-green-400' : 'bg-white/30',
                          )}
                        />
                        <span className="text-xs text-white/60">One lowercase letter</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div
                          className={classNames(
                            'w-2 h-2 rounded-full',
                            /[0-9]/.test(formData.password) ? 'bg-green-400' : 'bg-white/30',
                          )}
                        />
                        <span className="text-xs text-white/60">One number</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Confirm Password (Signup only) */}
                {mode === 'signup' && (
                  <div>
                    <label className="block text-sm font-medium text-white/80 mb-2">Confirm Password</label>
                    <input
                      type="password"
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      className={classNames(
                        'w-full px-4 py-3 rounded-lg bg-white/10 backdrop-blur',
                        'border border-white/20 text-white placeholder-white/40',
                        'focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-transparent',
                        'transition-all',
                        errors.confirmPassword && 'border-red-400',
                      )}
                      placeholder="Confirm your password"
                      required
                    />
                    {errors.confirmPassword && <p className="mt-1 text-sm text-red-300">{errors.confirmPassword}</p>}
                  </div>
                )}

                {/* Remember Me (Login only) */}
                {mode === 'login' && (
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      name="rememberMe"
                      id="rememberMe"
                      checked={formData.rememberMe}
                      onChange={handleInputChange}
                      className="w-4 h-4 rounded bg-white/10 border-white/20 text-blue-500 focus:ring-white/50"
                    />
                    <label htmlFor="rememberMe" className="ml-2 text-sm text-white/70">
                      Remember me for 7 days
                    </label>
                  </div>
                )}

                {/* Error Message */}
                {errors.general && (
                  <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/30">
                    <p className="text-sm text-red-200">{errors.general}</p>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className={classNames(
                    'w-full py-3 rounded-lg font-semibold transition-all',
                    'bg-gradient-to-r from-blue-500 to-purple-600 text-white',
                    'hover:from-blue-600 hover:to-purple-700',
                    'focus:outline-none focus:ring-2 focus:ring-purple-500/50',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    'flex items-center justify-center gap-2',
                    'shadow-lg hover:shadow-xl',
                  )}
                >
                  {loading ? (
                    <>
                      <span className="i-svg-spinners:3-dots-scale w-5 h-5" />
                      {mode === 'login' ? 'Signing in...' : 'Creating account...'}
                    </>
                  ) : mode === 'login' ? (
                    'Sign In'
                  ) : (
                    'Create Account'
                  )}
                </button>
              </motion.form>
            </AnimatePresence>

            {/* Developer Credit */}
            <div className="mt-8 pt-6 border-t border-white/10">
              <p className="text-center text-xs text-white/40">
                Developed by <span className="text-white/60 font-medium">Keoma Wright</span>
              </p>
            </div>

            {/* Continue as Guest */}
            <div className="pb-6">
              <button
                onClick={() => navigate('/')}
                className="w-full py-2 text-center text-sm text-white/60 hover:text-white transition-colors"
              >
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 19l-7-7m0 0l7-7m-7 7h18"
                    />
                  </svg>
                  Continue as Guest
                </span>
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
