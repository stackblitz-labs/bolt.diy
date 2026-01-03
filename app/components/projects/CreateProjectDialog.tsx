import React, { useEffect, useMemo, useState } from 'react';
import { DialogRoot, Dialog, DialogTitle, DialogDescription } from '~/components/ui/Dialog';
import { Input } from '~/components/ui/Input';
import { Button } from '~/components/ui/Button';
import type { CreateProjectInput } from '~/types/project';

interface CreateProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateProject: (input: CreateProjectInput) => Promise<void>;
  isLoading?: boolean;
  error?: string | null;
}

type Step = 'details' | 'maps' | 'confirm' | 'mapsError' | 'building';

export function CreateProjectDialog({
  isOpen,
  onClose,
  onCreateProject,
  isLoading = false,
  error = null,
}: CreateProjectDialogProps) {
  const [step, setStep] = useState<Step>('details');
  const [businessName, setBusinessName] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [mapsUrl, setMapsUrl] = useState('');
  const [mapsErrorMessage, setMapsErrorMessage] = useState('');
  const [touched, setTouched] = useState({ name: false, address: false, maps: false });

  useEffect(() => {
    if (isOpen) {
      setStep('details');
      setBusinessName('');
      setBusinessAddress('');
      setMapsUrl('');
      setMapsErrorMessage('');
      setTouched({ name: false, address: false, maps: false });
    }
  }, [isOpen]);

  useEffect(() => {
    if (step === 'building' && !isLoading && !error) {
      const timer = window.setTimeout(() => {
        onClose();
      }, 1200);
      return () => window.clearTimeout(timer);
    }

    return undefined;
  }, [step, isLoading, error, onClose]);

  const mapsUrlValid = useMemo(() => {
    if (!mapsUrl.trim()) {
      return false;
    }

    try {
      const url = new URL(mapsUrl.trim());
      const hostname = url.hostname.toLowerCase();

      if (hostname === 'maps.app.goo.gl' || hostname === 'goo.gl') {
        return true;
      }

      if (!hostname.endsWith('google.com')) {
        return false;
      }

      const hasMapsPath = url.pathname.includes('/maps');
      const hasQuery =
        url.searchParams.has('q') ||
        url.searchParams.has('query') ||
        url.searchParams.has('place_id') ||
        url.searchParams.has('cid');

      return hasMapsPath || hasQuery;
    } catch {
      return false;
    }
  }, [mapsUrl]);

  const nameError = touched.name && !businessName.trim() ? 'Business name is required' : null;
  const addressError = touched.address && !businessAddress.trim() ? 'Business address is required' : null;
  const mapsError = touched.maps && !mapsUrlValid ? 'Enter a valid Google Maps link' : null;

  const handleContinueDetails = () => {
    setTouched((prev) => ({ ...prev, name: true, address: true }));

    if (!businessName.trim() || !businessAddress.trim()) {
      return;
    }

    setStep('maps');
  };

  const handleSubmitMaps = () => {
    setTouched((prev) => ({ ...prev, maps: true }));

    if (!mapsUrlValid) {
      setMapsErrorMessage('Oops! We could not find a suitable business with that link.');
      setStep('mapsError');

      return;
    }

    setMapsErrorMessage('');
    setStep('confirm');
  };

  const handleConfirm = async () => {
    if (!businessName.trim() || !businessAddress.trim()) {
      setStep('details');
      setTouched((prev) => ({ ...prev, name: true, address: true }));

      return;
    }

    const payload: CreateProjectInput = {
      name: businessName.trim(),
      gmaps_url: mapsUrl.trim() || undefined,
      address: { line1: businessAddress.trim() },
    };
    setStep('building');
    await onCreateProject(payload);
  };

  return (
    <DialogRoot open={isOpen} onOpenChange={onClose}>
      <Dialog>
        <div className="w-[520px] max-w-[92vw]">
          {step === 'details' && (
            <div className="p-6">
              <DialogTitle>Welcome! Let’s get started</DialogTitle>
              <DialogDescription>Enter your business details so we can build your website.</DialogDescription>
              <div className="mt-6 space-y-5">
                <div>
                  <label
                    htmlFor="business-name"
                    className="block text-sm font-medium text-bolt-elements-textPrimary mb-2"
                  >
                    Business Name <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="business-name"
                    type="text"
                    value={businessName}
                    onChange={(event) => setBusinessName(event.target.value)}
                    onBlur={() => setTouched((prev) => ({ ...prev, name: true }))}
                    placeholder="Bloom & Grow Studio"
                    className={nameError ? 'border-red-500' : ''}
                    disabled={isLoading}
                    maxLength={255}
                    required
                  />
                  {nameError && <p className="mt-1 text-sm text-red-500">{nameError}</p>}
                </div>
                <div>
                  <label
                    htmlFor="business-address"
                    className="block text-sm font-medium text-bolt-elements-textPrimary mb-2"
                  >
                    Business Address <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="business-address"
                    type="text"
                    value={businessAddress}
                    onChange={(event) => setBusinessAddress(event.target.value)}
                    onBlur={() => setTouched((prev) => ({ ...prev, address: true }))}
                    placeholder="123 Main St, New York, NY"
                    className={addressError ? 'border-red-500' : ''}
                    disabled={isLoading}
                    maxLength={255}
                    required
                  />
                  {addressError && <p className="mt-1 text-sm text-red-500">{addressError}</p>}
                </div>
                <div className="flex justify-end pt-2">
                  <Button
                    type="button"
                    onClick={handleContinueDetails}
                    className="bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent hover:bg-bolt-elements-button-primary-backgroundHover"
                  >
                    Continue
                  </Button>
                </div>
              </div>
            </div>
          )}

          {step === 'maps' && (
            <div className="p-6">
              <DialogTitle>Find your business on Maps</DialogTitle>
              <DialogDescription>Paste your Google Maps link so we can verify your location.</DialogDescription>
              <div className="mt-6 space-y-6">
                <div>
                  <label htmlFor="maps-link" className="block text-sm font-medium text-bolt-elements-textPrimary mb-2">
                    Google Maps Link <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="maps-link"
                    type="url"
                    value={mapsUrl}
                    onChange={(event) => setMapsUrl(event.target.value)}
                    onBlur={() => setTouched((prev) => ({ ...prev, maps: true }))}
                    placeholder="https://maps.app.goo.gl/..."
                    className={mapsError ? 'border-red-500' : ''}
                    disabled={isLoading}
                    required
                  />
                  {mapsError && <p className="mt-1 text-sm text-red-500">{mapsError}</p>}
                </div>
                <div className="rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 p-4 text-sm text-bolt-elements-textSecondary">
                  Go to Google Maps, search for your business, click Share, and copy the link.
                </div>
                <div className="flex flex-col gap-3 sm:flex-row-reverse">
                  <Button
                    type="button"
                    onClick={handleSubmitMaps}
                    className="bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent hover:bg-bolt-elements-button-primary-backgroundHover"
                  >
                    Submit Link
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setStep('details')}>
                    Go Back
                  </Button>
                </div>
              </div>
            </div>
          )}

          {step === 'confirm' && (
            <div className="p-6">
              <DialogTitle>Is this your company?</DialogTitle>
              <DialogDescription>We found a match based on your details.</DialogDescription>
              <div className="mt-6 space-y-6">
                <div className="rounded-xl border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 p-4">
                  <div className="text-lg font-semibold text-bolt-elements-textPrimary truncate">{businessName}</div>
                  <div className="text-sm text-bolt-elements-textSecondary mt-1">{businessAddress}</div>
                </div>
                {error && (
                  <div className="p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-md">
                    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                  </div>
                )}
                <div className="flex flex-col gap-3">
                  <Button
                    type="button"
                    onClick={handleConfirm}
                    disabled={isLoading}
                    className="bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent hover:bg-bolt-elements-button-primary-backgroundHover"
                  >
                    {isLoading ? (
                      <>
                        <div className="i-ph-spinner-gap-bold animate-spin w-4 h-4 mr-2" />
                        Creating...
                      </>
                    ) : (
                      'Yes, this is my business'
                    )}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setStep('maps')} disabled={isLoading}>
                    No, provide a Google Maps link
                  </Button>
                </div>
              </div>
            </div>
          )}

          {step === 'mapsError' && (
            <div className="p-6">
              <DialogTitle>Google Maps Link</DialogTitle>
              <DialogDescription>We could not verify that link.</DialogDescription>
              <div className="mt-6 space-y-6">
                <div>
                  <label
                    htmlFor="maps-link-error"
                    className="block text-sm font-medium text-bolt-elements-textPrimary mb-2"
                  >
                    Google Maps Link <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="maps-link-error"
                    type="url"
                    value={mapsUrl}
                    onChange={(event) => setMapsUrl(event.target.value)}
                    className="border-red-500"
                    disabled={isLoading}
                    required
                  />
                </div>
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
                  {mapsErrorMessage}
                </div>
                <div className="flex flex-col gap-3 sm:flex-row-reverse">
                  <Button
                    type="button"
                    onClick={() => setStep('maps')}
                    className="bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent hover:bg-bolt-elements-button-primary-backgroundHover"
                  >
                    Retry Submission
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setStep('details')}>
                    Go Back
                  </Button>
                  <Button type="button" variant="outline" onClick={onClose}>
                    Return to Dashboard
                  </Button>
                </div>
              </div>
            </div>
          )}

          {step === 'building' && (
            <div className="p-6">
              <DialogTitle>Building your website</DialogTitle>
              <DialogDescription>Our AI is setting everything up for you.</DialogDescription>
              <div className="mt-6 space-y-6">
                <div className="flex flex-col items-center gap-4 text-center">
                  <div className="relative h-24 w-24">
                    <div className="absolute inset-0 rounded-full border-4 border-bolt-elements-borderColor" />
                    <div className="absolute inset-0 rounded-full border-4 border-bolt-elements-item-backgroundAccent border-t-transparent animate-spin" />
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-bolt-elements-textPrimary">
                      Building your dream website
                    </div>
                    <div className="text-sm text-bolt-elements-textSecondary">
                      Sit tight while we generate your layout and copy.
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 p-3 text-sm">
                    <div className="h-6 w-6 rounded-full bg-bolt-elements-item-backgroundAccent/10 text-bolt-elements-item-backgroundAccent flex items-center justify-center">
                      <span className="i-ph-check w-4 h-4" />
                    </div>
                    <span className="text-bolt-elements-textSecondary line-through">Analyzing business details</span>
                  </div>
                  <div className="flex items-center gap-3 rounded-lg border border-bolt-elements-borderColor bg-white p-3 text-sm">
                    <div className="h-6 w-6 rounded-full border-2 border-bolt-elements-item-backgroundAccent border-t-transparent animate-spin" />
                    <span className="text-bolt-elements-textPrimary font-semibold">Generating layout & copy...</span>
                  </div>
                  <div className="flex items-center gap-3 rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 p-3 text-sm opacity-70">
                    <div className="h-6 w-6 rounded-full border-2 border-bolt-elements-borderColor" />
                    <span className="text-bolt-elements-textSecondary">Final polish & SEO check</span>
                  </div>
                </div>
                {error && (
                  <div className="p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-md">
                    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <Button
                        type="button"
                        onClick={handleConfirm}
                        className="bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent hover:bg-bolt-elements-button-primary-backgroundHover"
                      >
                        Try Again
                      </Button>
                      <Button type="button" variant="outline" onClick={() => setStep('confirm')}>
                        Back
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </Dialog>
    </DialogRoot>
  );
}
