import React, { useState, useEffect } from 'react';
import { classNames } from '~/utils/classNames';
import { Dialog } from '~/components/ui/Dialog';
import * as RadixDialog from '@radix-ui/react-dialog';
import { Button } from '~/components/ui/Button';
import { Input } from '~/components/ui/Input';
import { toast } from 'react-toastify';
import { MultiUserSessionManager } from './MultiUserSessionManager';

interface MultiUserToggleProps {
  className?: string;
}

export const MultiUserToggle: React.FC<MultiUserToggleProps> = ({ className }) => {
  const [isEnabled, setIsEnabled] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [organizationName, setOrganizationName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [maxUsers, setMaxUsers] = useState('10');
  const [sessionTimeout, setSessionTimeout] = useState('30');
  const [allowGuestAccess, setAllowGuestAccess] = useState(false);

  // Check if this is bolt.gives (exclusive feature)
  const isBoltGives = window.location.hostname === 'bolt.openweb.live' || window.location.hostname === 'localhost';

  useEffect(() => {
    // Check if multi-user is already enabled
    const multiUserEnabled = localStorage.getItem('multiUserEnabled') === 'true';
    setIsEnabled(multiUserEnabled);
  }, []);

  const handleToggle = () => {
    if (!isBoltGives) {
      toast.error('Multi-User Sessions is a Bolt.gives exclusive feature');
      return;
    }

    if (!isEnabled) {
      // Show wizard to set up multi-user
      setShowWizard(true);
      setCurrentStep(1);
    } else {
      // Confirm disable
      if (window.confirm('Are you sure you want to disable Multi-User Sessions?')) {
        setIsEnabled(false);
        localStorage.setItem('multiUserEnabled', 'false');
        toast.success('Multi-User Sessions disabled');
      }
    }
  };

  const handleNextStep = () => {
    if (currentStep === 1) {
      if (!organizationName.trim()) {
        toast.error('Please enter an organization name');
        return;
      }
    } else if (currentStep === 2) {
      if (!adminEmail.trim() || !adminPassword.trim()) {
        toast.error('Please enter admin credentials');
        return;
      }

      if (adminPassword.length < 8) {
        toast.error('Password must be at least 8 characters');
        return;
      }
    }

    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    } else {
      // Complete setup
      handleCompleteSetup();
    }
  };

  const handleCompleteSetup = async () => {
    try {
      // Save configuration
      const config = {
        organizationName,
        adminEmail,
        maxUsers: parseInt(maxUsers),
        sessionTimeout: parseInt(sessionTimeout),
        allowGuestAccess,
        enabled: true,
        setupDate: new Date().toISOString(),
      };

      // Store in localStorage (in production, this would be server-side)
      localStorage.setItem('multiUserConfig', JSON.stringify(config));
      localStorage.setItem('multiUserEnabled', 'true');

      // Create admin user
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: adminEmail,
          password: adminPassword,
          role: 'admin',
          organization: organizationName,
        }),
      });

      if (response.ok) {
        setIsEnabled(true);
        setShowWizard(false);
        toast.success('Multi-User Sessions enabled successfully!');

        // Auto-login the admin
        const loginResponse = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: adminEmail,
            password: adminPassword,
          }),
        });

        if (loginResponse.ok) {
          window.location.reload();
        }
      } else {
        const error = (await response.json()) as { message?: string };
        toast.error(error.message || 'Failed to setup Multi-User Sessions');
      }
    } catch (error) {
      console.error('Setup error:', error);

      const errorMessage = error instanceof Error ? error.message : 'Failed to setup Multi-User Sessions';
      toast.error(errorMessage);
    }
  };

  if (!isBoltGives) {
    return null; // Feature not available for non-bolt.gives deployments
  }

  // If multi-user is enabled, show the session manager instead
  if (isEnabled) {
    return (
      <div className="flex items-center gap-2">
        <MultiUserSessionManager />
        <button
          onClick={handleToggle}
          className="p-1.5 text-xs text-bolt-elements-textSecondary hover:text-red-400 transition-all"
          title="Disable Multi-User Sessions"
        >
          <span className="i-ph:power text-sm" />
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={handleToggle}
        className={classNames(
          'flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all',
          'border border-bolt-elements-borderColor',
          'hover:bg-bolt-elements-background-depth-2',
          isEnabled
            ? 'bg-gradient-to-r from-green-500/20 to-blue-500/20 border-green-500/30'
            : 'bg-bolt-elements-background-depth-1',
          className,
        )}
        title={isEnabled ? 'Multi-User Sessions Active' : 'Enable Multi-User Sessions'}
      >
        <span
          className={classNames(
            'text-sm',
            isEnabled ? 'i-ph:users-three-fill text-green-400' : 'i-ph:users-three text-bolt-elements-textSecondary',
          )}
        />
        <span
          className={classNames(
            'text-xs font-medium hidden sm:inline',
            isEnabled ? 'text-green-400' : 'text-bolt-elements-textSecondary',
          )}
        >
          {isEnabled ? 'Multi-User' : 'Single User'}
        </span>
      </button>

      {showWizard && (
        <RadixDialog.Root open={showWizard} onOpenChange={setShowWizard}>
          <Dialog className="max-w-md" onClose={() => setShowWizard(false)}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-bolt-elements-textPrimary">Setup Multi-User Sessions</h2>
                <span className="text-xs text-bolt-elements-textSecondary">Step {currentStep} of 4</span>
              </div>

              {/* Progress Bar */}
              <div className="flex gap-1 mb-6">
                {[1, 2, 3, 4].map((step) => (
                  <div
                    key={step}
                    className={classNames(
                      'flex-1 h-1 rounded-full transition-all',
                      step <= currentStep
                        ? 'bg-gradient-to-r from-green-500 to-blue-500'
                        : 'bg-bolt-elements-borderColor',
                    )}
                  />
                ))}
              </div>

              {/* Step 1: Organization Setup */}
              {currentStep === 1 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-medium text-bolt-elements-textPrimary mb-2">Organization Setup</h3>
                    <p className="text-sm text-bolt-elements-textSecondary mb-4">
                      Configure your organization for multi-user collaboration
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-bolt-elements-textPrimary mb-2">
                      Organization Name
                    </label>
                    <Input
                      value={organizationName}
                      onChange={(e) => setOrganizationName(e.target.value)}
                      placeholder="e.g., Acme Corp"
                      className="w-full"
                    />
                  </div>
                </div>
              )}

              {/* Step 2: Admin Account */}
              {currentStep === 2 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-medium text-bolt-elements-textPrimary mb-2">Admin Account</h3>
                    <p className="text-sm text-bolt-elements-textSecondary mb-4">
                      Create the administrator account for managing users
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-bolt-elements-textPrimary mb-2">Admin Email</label>
                    <Input
                      type="email"
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      placeholder="admin@example.com"
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-bolt-elements-textPrimary mb-2">
                      Admin Password
                    </label>
                    <Input
                      type="password"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      placeholder="Minimum 8 characters"
                      className="w-full"
                    />
                  </div>
                </div>
              )}

              {/* Step 3: Session Settings */}
              {currentStep === 3 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-medium text-bolt-elements-textPrimary mb-2">Session Settings</h3>
                    <p className="text-sm text-bolt-elements-textSecondary mb-4">
                      Configure session limits and security
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-bolt-elements-textPrimary mb-2">
                      Maximum Concurrent Users
                    </label>
                    <Input
                      type="number"
                      value={maxUsers}
                      onChange={(e) => setMaxUsers(e.target.value)}
                      min="2"
                      max="100"
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-bolt-elements-textPrimary mb-2">
                      Session Timeout (minutes)
                    </label>
                    <Input
                      type="number"
                      value={sessionTimeout}
                      onChange={(e) => setSessionTimeout(e.target.value)}
                      min="5"
                      max="1440"
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={allowGuestAccess}
                        onChange={(e) => setAllowGuestAccess(e.target.checked)}
                        className="rounded border-bolt-elements-borderColor"
                      />
                      <span className="text-sm text-bolt-elements-textPrimary">Allow guest access (read-only)</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Step 4: Review & Confirm */}
              {currentStep === 4 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-medium text-bolt-elements-textPrimary mb-2">Review Configuration</h3>
                    <p className="text-sm text-bolt-elements-textSecondary mb-4">
                      Please review your settings before enabling Multi-User Sessions
                    </p>
                  </div>

                  <div className="space-y-2 p-4 bg-bolt-elements-background-depth-2 rounded-lg">
                    <div className="flex justify-between text-sm">
                      <span className="text-bolt-elements-textSecondary">Organization:</span>
                      <span className="text-bolt-elements-textPrimary font-medium">{organizationName}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-bolt-elements-textSecondary">Admin Email:</span>
                      <span className="text-bolt-elements-textPrimary font-medium">{adminEmail}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-bolt-elements-textSecondary">Max Users:</span>
                      <span className="text-bolt-elements-textPrimary font-medium">{maxUsers}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-bolt-elements-textSecondary">Session Timeout:</span>
                      <span className="text-bolt-elements-textPrimary font-medium">{sessionTimeout} minutes</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-bolt-elements-textSecondary">Guest Access:</span>
                      <span className="text-bolt-elements-textPrimary font-medium">
                        {allowGuestAccess ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                    <p className="text-xs text-blue-400">
                      <span className="font-semibold">Note:</span> Multi-User Sessions is a Bolt.gives exclusive
                      feature. You can manage users, sessions, and permissions from the admin panel after setup.
                    </p>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-between mt-6">
                <Button
                  variant="secondary"
                  onClick={() => {
                    if (currentStep > 1) {
                      setCurrentStep(currentStep - 1);
                    } else {
                      setShowWizard(false);
                    }
                  }}
                >
                  {currentStep === 1 ? 'Cancel' : 'Back'}
                </Button>

                <Button
                  variant="default"
                  onClick={handleNextStep}
                  className="bg-gradient-to-r from-green-500 to-blue-500"
                >
                  {currentStep === 4 ? 'Enable Multi-User' : 'Next'}
                </Button>
              </div>
            </div>
          </Dialog>
        </RadixDialog.Root>
      )}
    </>
  );
};
