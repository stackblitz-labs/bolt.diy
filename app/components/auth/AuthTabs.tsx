import { useState } from 'react';
import { Login } from './Login';
import { Register } from './Register';

export function AuthTabs() {
  const [showLogin, setShowLogin] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const handleSwitchToRegister = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      setShowLogin(false);
      setIsTransitioning(false);
    }, 300);
  };

  const handleSwitchToLogin = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      setShowLogin(true);
      setIsTransitioning(false);
    }, 300);
  };

  return (
    <div className="relative w-full h-full">
      <div className="absolute inset-0">
        {/* Login Background */}
        <div
          className={`absolute inset-0 bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 transition-opacity duration-700 ease-in-out ${
            showLogin ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl animate-pulse"></div>
            <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl animate-pulse delay-700"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
          </div>
        </div>

        {/* Register Background */}
        <div
          className={`absolute inset-0 bg-gradient-to-br from-slate-950 via-purple-950 to-slate-900 transition-opacity duration-700 ease-in-out ${
            !showLogin ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl animate-pulse"></div>
            <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl animate-pulse delay-700"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
          </div>
        </div>
      </div>

      <div className="relative w-full h-full overflow-hidden">
        {/* Login Form */}
        <div
          className={`absolute inset-0 transition-all duration-500 ease-in-out ${
            showLogin && !isTransitioning
              ? 'translate-x-0 opacity-100'
              : showLogin && isTransitioning
                ? '-translate-x-full opacity-0'
                : 'translate-x-full opacity-0'
          }`}
        >
          <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
            <div className="relative max-w-md w-full mx-4">
              <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl shadow-2xl p-8 transition-all duration-300 hover:shadow-blue-500/20">
                <Login
                  onLoginSuccess={() => {
                    window.location.href = '/';
                  }}
                  onSwitchToRegister={handleSwitchToRegister}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Register Form */}
        <div
          className={`absolute inset-0 transition-all duration-500 ease-in-out ${
            !showLogin && !isTransitioning
              ? 'translate-x-0 opacity-100'
              : !showLogin && isTransitioning
                ? 'translate-x-full opacity-0'
                : '-translate-x-full opacity-0'
          }`}
        >
          <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
            <div className="relative max-w-md w-full">
              <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl shadow-2xl p-8 transition-all duration-300 hover:shadow-purple-500/20">
                <Register
                  onRegisterSuccess={() => {
                    setShowLogin(true);
                  }}
                  onSwitchToLogin={handleSwitchToLogin}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
