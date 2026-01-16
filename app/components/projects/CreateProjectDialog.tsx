import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from '@remix-run/react';
import { toast } from 'react-toastify';
import { DialogRoot, Dialog, DialogTitle, DialogDescription } from '~/components/ui/Dialog';
import { Input } from '~/components/ui/Input';
import { Button } from '~/components/ui/Button';
import type { CreateProjectInput, Project } from '~/types/project';
import type { BusinessData } from '~/types/crawler';
import type { GeneratedFile, GenerationProgress, GenerationResult } from '~/types/generation';
import { workbenchStore } from '~/lib/stores/workbench';

interface CreateProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateProject: (input: CreateProjectInput) => Promise<Project | null>;
  isLoading?: boolean;
  error?: string | null;
}

type Step = 'details' | 'maps' | 'crawling' | 'review' | 'confirm' | 'mapsError' | 'building';

export function CreateProjectDialog({
  isOpen,
  onClose,
  onCreateProject,
  isLoading = false,
  error = null,
}: CreateProjectDialogProps) {
  const [step, setStep] = useState<Step>('details');
  const navigate = useNavigate();

  // Basic business info
  const [businessName, setBusinessName] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [mapsUrl, setMapsUrl] = useState('');

  // Crawler state
  const [sessionId] = useState(() => crypto.randomUUID());
  const [crawledData, setCrawledData] = useState<BusinessData | null>(null);
  const [crawlError, setCrawlError] = useState<string | null>(null);
  const [isCrawling, setIsCrawling] = useState(false);
  const [websiteCrawled, setWebsiteCrawled] = useState(false);
  const [fallbackMode, setFallbackMode] = useState(false);

  // Review/edit state
  const [editedName, setEditedName] = useState('');
  const [editedAddress, setEditedAddress] = useState('');
  const [editedPhone, setEditedPhone] = useState('');
  const [editedWebsite, setEditedWebsite] = useState('');
  const [showHours, setShowHours] = useState(false);

  // Progress indicator for crawling step
  const [crawlProgress, setCrawlProgress] = useState<'connecting' | 'extracting' | 'done'>('connecting');

  const [touched, setTouched] = useState({ name: false, address: false, maps: false });

  // Generation state (Phase 3)
  const [createdProject, setCreatedProject] = useState<Project | null>(null);
  const [generationProgress, setGenerationProgress] = useState<GenerationProgress | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [generatedFiles, setGeneratedFiles] = useState<GeneratedFile[]>([]);
  const [generationComplete, setGenerationComplete] = useState<GenerationResult | null>(null);
  const [generationAttempt, setGenerationAttempt] = useState(0);
  const [showTakingLonger, setShowTakingLonger] = useState(false);
  const generationStartedAtRef = useRef<number | null>(null);
  const generationAbortRef = useRef<AbortController | null>(null);
  const completionHandledRef = useRef<boolean>(false);

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      setStep('details');
      setBusinessName('');
      setBusinessAddress('');
      setMapsUrl('');
      setTouched({ name: false, address: false, maps: false });
      setCrawledData(null);
      setCrawlError(null);
      setIsCrawling(false);
      setWebsiteCrawled(false);
      setFallbackMode(false);
      setCrawlProgress('connecting');
      setShowHours(false);

      setCreatedProject(null);
      setGenerationProgress(null);
      setGenerationError(null);
      setSelectedTemplate(null);
      setGeneratedFiles([]);
      setGenerationComplete(null);
      setGenerationAttempt(0);
      setShowTakingLonger(false);
      generationStartedAtRef.current = null;
      generationAbortRef.current?.abort();
      generationAbortRef.current = null;
      completionHandledRef.current = false;
    }
  }, [isOpen]);

  // Abort generation stream when dialog closes/unmounts
  useEffect(() => {
    if (!isOpen) {
      generationAbortRef.current?.abort();
      generationAbortRef.current = null;
    }
  }, [isOpen]);

  // Update crawl progress indicators
  useEffect(() => {
    if (step === 'crawling' && isCrawling) {
      const timer1 = window.setTimeout(() => {
        setCrawlProgress('extracting');
      }, 3000);

      const timer2 = window.setTimeout(() => {
        setCrawlProgress('done');
      }, 10000);

      return () => {
        window.clearTimeout(timer1);
        window.clearTimeout(timer2);
      };
    }

    return undefined;
  }, [step, isCrawling]);

  // Initialize edit fields when entering review step
  useEffect(() => {
    if (step === 'review' && crawledData) {
      setEditedName(crawledData.name || businessName);
      setEditedAddress(crawledData.address || businessAddress);
      setEditedPhone(crawledData.phone || '');
      setEditedWebsite(crawledData.website || '');

      // Track if website was successfully crawled
      setWebsiteCrawled(!!crawledData.website && crawledData.website.trim().length > 0);
    }
  }, [step, crawledData, businessName, businessAddress]);

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

  const handleSubmitMaps = async () => {
    setTouched((prev) => ({ ...prev, maps: true }));

    if (!mapsUrlValid) {
      setStep('mapsError');

      return;
    }

    setStep('crawling');
    setIsCrawling(true);
    setCrawlProgress('connecting');

    try {
      const response = await fetch('/api/crawler/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: sessionId,
          google_maps_url: mapsUrl.trim(),
        }),
      });

      const result: { success?: boolean; data?: BusinessData; error?: string | { message?: string } } =
        await response.json();

      if (response.ok && result.success && result.data) {
        setCrawledData(result.data);
        setWebsiteCrawled(!!result.data.website && result.data.website.trim().length > 0);
        setIsCrawling(false);
        setStep('review');
      } else {
        const errorMessage =
          typeof result.error === 'string' ? result.error : result.error?.message || 'Failed to extract business data';
        setCrawlError(errorMessage);
        setIsCrawling(false);
        setStep('mapsError');
      }
    } catch (err) {
      console.error('Crawler error:', err);
      setCrawlError('Failed to connect to data extraction service. Please try again.');
      setIsCrawling(false);
      setStep('mapsError');
    }
  };

  const handleContinueFromReview = () => {
    if (!editedName.trim() || !editedAddress.trim()) {
      return;
    }

    setBusinessName(editedName.trim());
    setBusinessAddress(editedAddress.trim());
    setStep('confirm');
  };

  const handleConfirm = async () => {
    if (!businessName.trim() || !businessAddress.trim()) {
      setStep('details');
      setTouched((prev) => ({ ...prev, name: true, address: true }));

      return;
    }

    setStep('building');

    setGenerationError(null);
    setGenerationProgress(null);
    setSelectedTemplate(null);
    setGeneratedFiles([]);
    setGenerationComplete(null);

    // Always attach a minimal businessProfile so generation can proceed even in fallback mode
    const businessProfile = {
      session_id: sessionId,
      gmaps_url: mapsUrl.trim() || undefined,
      crawled_data: (crawledData ?? {
        name: businessName.trim(),
        address: businessAddress.trim(),
      }) as BusinessData,
      crawled_at: new Date().toISOString(),
    };

    const payload: CreateProjectInput = {
      name: businessName.trim(),
      gmaps_url: mapsUrl.trim() || undefined,
      address: { line1: businessAddress.trim() },
      session_id: sessionId,
      businessProfile,
    };

    const project = await onCreateProject(payload);

    if (!project) {
      setGenerationError('Failed to create project');
      return;
    }

    setCreatedProject(project);
  };

  useEffect(() => {
    if (step !== 'building' || !createdProject?.id || generationAbortRef.current) {
      return undefined;
    }

    const controller = new AbortController();
    generationAbortRef.current = controller;
    generationStartedAtRef.current = Date.now();
    setShowTakingLonger(false);

    const takingLongerTimer = window.setTimeout(() => {
      setShowTakingLonger(true);
    }, 60_000);

    const run = async () => {
      try {
        console.log('[Generation] Starting POST request to /api/project/generate', {
          projectId: createdProject.id,
          method: 'POST',
        });

        const response = await fetch('/api/project/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId: createdProject.id }),
          signal: controller.signal,
        });

        console.log('[Generation] Response received', {
          status: response.status,
          ok: response.ok,
          headers: Object.fromEntries(response.headers.entries()),
        });

        if (!response.ok || !response.body) {
          let message = `Generation request failed (${response.status})`;

          try {
            const errorData = (await response.json()) as { error?: { message?: string } };
            message = errorData?.error?.message || message;
            console.error('[Generation] Error response:', errorData);
          } catch (parseError) {
            console.error('[Generation] Failed to parse error response:', parseError);
          }

          setGenerationError(message);

          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        const handleEvent = (eventName: string, dataJson: string) => {
          try {
            const data = JSON.parse(dataJson) as unknown;

            if (eventName === 'progress') {
              setGenerationProgress(data as GenerationProgress);

              return;
            }

            if (eventName === 'template_selected') {
              const payload = data as { name?: string };
              setSelectedTemplate(payload.name ?? null);

              return;
            }

            if (eventName === 'file') {
              const file = data as GeneratedFile;
              setGeneratedFiles((prev) => [...prev, file]);

              return;
            }

            if (eventName === 'complete') {
              setGenerationComplete(data as GenerationResult);

              return;
            }

            if (eventName === 'error') {
              const payload = data as { message?: string };
              console.error('[Generation] Error event received:', payload);
              setGenerationError(payload.message ?? 'Generation failed');
            }
          } catch (parseError) {
            console.warn('[Generation] Malformed event payload:', { eventName, dataJson, parseError });

            // ignore malformed event payload
          }
        };

        while (true) {
          const { value, done } = await reader.read();

          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });

          let idx: number;

          while ((idx = buffer.indexOf('\n\n')) !== -1) {
            const rawEvent = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);

            const lines = rawEvent.split('\n').map((l) => l.trim());
            const eventLine = lines.find((l) => l.startsWith('event:'));
            const dataLine = lines.find((l) => l.startsWith('data:'));

            if (!eventLine || !dataLine) {
              continue;
            }

            const eventName = eventLine.replace('event:', '').trim();
            const dataJson = dataLine.replace('data:', '').trim();
            handleEvent(eventName, dataJson);
          }
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          console.log('[Generation] Request aborted by user');

          return;
        }

        console.error('[Generation] Stream processing failed:', err);
        setGenerationError(err instanceof Error ? err.message : 'Generation failed');
      } finally {
        generationAbortRef.current = null;
        window.clearTimeout(takingLongerTimer);
      }
    };

    void run();

    return () => {
      window.clearTimeout(takingLongerTimer);
      controller.abort();
    };
  }, [createdProject?.id, generationAttempt, step]);

  // When generation completes, inject files and navigate to the project chat
  useEffect(() => {
    if (!generationComplete || !createdProject || completionHandledRef.current) {
      return;
    }

    completionHandledRef.current = true;

    const run = async () => {
      try {
        const filesToInject = generationComplete.files?.length ? generationComplete.files : generatedFiles;

        for (const file of filesToInject) {
          await workbenchStore.createFile(file.path, file.content);
        }

        toast.success('Website generated successfully!');
        onClose();
        navigate(`/chat/${createdProject.url_id ?? createdProject.id}`);
      } catch (err) {
        completionHandledRef.current = false;
        setGenerationError(err instanceof Error ? err.message : 'Failed to inject generated files');
      }
    };

    void run();
  }, [createdProject, generationComplete, generatedFiles, navigate, onClose]);

  return (
    <DialogRoot open={isOpen} onOpenChange={onClose}>
      <Dialog>
        <div className="w-[520px] max-w-[92vw]">
          {/* DETAILS STEP */}
          {step === 'details' && (
            <div className="p-6">
              <DialogTitle>Welcome! Let's get started</DialogTitle>
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

          {/* MAPS STEP */}
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

          {/* CRAWLING STEP */}
          {step === 'crawling' && (
            <div className="p-6">
              <DialogTitle>Extracting business data...</DialogTitle>
              <DialogDescription>Please wait while we gather information from Google Maps.</DialogDescription>
              <div className="mt-6 space-y-6">
                <div className="flex flex-col items-center gap-4 text-center">
                  <div className="relative h-24 w-24">
                    <div className="absolute inset-0 rounded-full border-4 border-bolt-elements-borderColor" />
                    <div className="absolute inset-0 rounded-full border-4 border-bolt-elements-item-backgroundAccent border-t-transparent animate-spin" />
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-bolt-elements-textPrimary">
                      {crawlProgress === 'connecting' && 'Connecting to Google Maps...'}
                      {crawlProgress === 'extracting' && 'Extracting business information...'}
                      {crawlProgress === 'done' && 'Almost done...'}
                    </div>
                    <div className="text-sm text-bolt-elements-textSecondary mt-1">
                      This usually takes 10-30 seconds
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* REVIEW STEP */}
          {step === 'review' && (
            <div className="p-6">
              <DialogTitle>Review your business information</DialogTitle>
              <DialogDescription>We found the following details. Edit if needed.</DialogDescription>
              <div className="mt-6 space-y-4">
                <div>
                  <label htmlFor="edit-name" className="block text-sm font-medium text-bolt-elements-textPrimary mb-2">
                    Business Name <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="edit-name"
                    type="text"
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    className="w-full"
                    disabled={isLoading}
                    required
                  />
                </div>
                <div>
                  <label
                    htmlFor="edit-address"
                    className="block text-sm font-medium text-bolt-elements-textPrimary mb-2"
                  >
                    Address <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="edit-address"
                    type="text"
                    value={editedAddress}
                    onChange={(e) => setEditedAddress(e.target.value)}
                    className="w-full"
                    disabled={isLoading}
                    required
                  />
                </div>
                {editedPhone && (
                  <div>
                    <label
                      htmlFor="edit-phone"
                      className="block text-sm font-medium text-bolt-elements-textPrimary mb-2"
                    >
                      Phone
                    </label>
                    <Input
                      id="edit-phone"
                      type="tel"
                      value={editedPhone}
                      onChange={(e) => setEditedPhone(e.target.value)}
                      className="w-full"
                      disabled={isLoading}
                    />
                  </div>
                )}
                {editedWebsite && (
                  <div>
                    <label
                      htmlFor="edit-website"
                      className="block text-sm font-medium text-bolt-elements-textPrimary mb-2"
                    >
                      Website
                    </label>
                    <Input
                      id="edit-website"
                      type="url"
                      value={editedWebsite}
                      onChange={(e) => setEditedWebsite(e.target.value)}
                      className="w-full"
                      disabled={isLoading}
                    />
                  </div>
                )}

                {/* Non-editable additional data */}
                {crawledData && (crawledData.rating || crawledData.reviews_count) && (
                  <div className="rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 p-4">
                    <div className="flex items-center gap-4">
                      {crawledData.rating && (
                        <div className="flex items-center gap-1">
                          <span className="text-lg font-semibold text-bolt-elements-textPrimary">
                            {crawledData.rating.toFixed(1)}
                          </span>
                          <span className="i-ph-star-fill text-yellow-500 w-5 h-5" />
                        </div>
                      )}
                      {crawledData.reviews_count && (
                        <div className="text-sm text-bolt-elements-textSecondary">
                          {crawledData.reviews_count} reviews
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Operating hours */}
                {crawledData?.hours && Object.keys(crawledData.hours).length > 0 && (
                  <div className="rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1">
                    <button
                      type="button"
                      onClick={() => setShowHours(!showHours)}
                      className="w-full px-4 py-3 flex items-center justify-between text-left"
                    >
                      <span className="text-sm font-medium text-bolt-elements-textPrimary">Operating Hours</span>
                      <span
                        className={`i-ph-caret-${showHours ? 'up' : 'down'}-bold w-4 h-4 text-bolt-elements-textSecondary`}
                      />
                    </button>
                    {showHours && (
                      <div className="px-4 pb-4 space-y-2">
                        {Object.entries(crawledData.hours).map(([day, hours]) => (
                          <div key={day} className="flex justify-between text-sm">
                            <span className="text-bolt-elements-textPrimary capitalize">{day}</span>
                            <span className="text-bolt-elements-textSecondary">{hours}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Website crawling indicators */}
                {crawledData && websiteCrawled && (
                  <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-500/10 dark:border-green-500/20 p-3">
                    <p className="text-sm text-green-600 dark:text-green-400">✓ Website content extracted</p>
                  </div>
                )}

                {crawledData && !websiteCrawled && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-500/10 dark:border-blue-500/20 p-3">
                    <p className="text-sm text-blue-600 dark:text-blue-400">
                      ℹ No website found - using Google Maps data only
                    </p>
                    <p className="text-xs text-blue-500 dark:text-blue-500/70 mt-2">
                      Website data helps generate more accurate content including menu items, services, and about page
                      text.
                    </p>
                  </div>
                )}

                <div className="flex flex-col gap-3 sm:flex-row-reverse pt-2">
                  <Button
                    type="button"
                    onClick={handleContinueFromReview}
                    disabled={isLoading || !editedName.trim() || !editedAddress.trim()}
                    className="bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent hover:bg-bolt-elements-button-primary-backgroundHover"
                  >
                    Continue
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setStep('maps')} disabled={isLoading}>
                    Go Back
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* CONFIRM STEP */}
          {step === 'confirm' && (
            <div className="p-6">
              <DialogTitle>Is this your company?</DialogTitle>
              <DialogDescription>We found a match based on your details.</DialogDescription>
              <div className="mt-6 space-y-6">
                <div className="rounded-xl border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 p-4">
                  <div className="text-lg font-semibold text-bolt-elements-textPrimary truncate">{businessName}</div>
                  <div className="text-sm text-bolt-elements-textSecondary mt-1">{businessAddress}</div>
                  {(crawledData?.rating || crawledData?.reviews_count) && (
                    <div className="flex items-center gap-4 mt-3">
                      {crawledData.rating && (
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-semibold text-bolt-elements-textPrimary">
                            {crawledData.rating.toFixed(1)}
                          </span>
                          <span className="i-ph-star-fill text-yellow-500 w-4 h-4" />
                        </div>
                      )}
                      {crawledData.reviews_count && (
                        <div className="text-sm text-bolt-elements-textSecondary">
                          {crawledData.reviews_count} reviews
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {fallbackMode && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-500/10 dark:border-blue-500/20 p-3">
                    <p className="text-sm text-blue-600 dark:text-blue-400">
                      You'll be able to add more details after your project is created
                    </p>
                  </div>
                )}
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
                  <Button type="button" variant="outline" onClick={() => setStep('review')} disabled={isLoading}>
                    Edit information
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* MAPS ERROR STEP */}
          {step === 'mapsError' && (
            <div className="p-6">
              <DialogTitle>Google Maps Link</DialogTitle>
              <DialogDescription>{crawlError || 'We could not verify that link.'}</DialogDescription>
              <div className="mt-6 space-y-6">
                {crawlError && crawlError.includes('timed out') && (
                  <div className="rounded-lg border border-orange-200 bg-orange-50 dark:bg-orange-500/10 dark:border-orange-500/20 p-4 text-sm text-orange-600 dark:text-orange-400">
                    The data extraction is taking longer than expected. You can try again or proceed with the
                    information you provided.
                  </div>
                )}
                <div className="flex flex-col gap-3 sm:flex-row-reverse">
                  <Button
                    type="button"
                    onClick={() => {
                      setCrawlError(null);
                      setStep('maps');
                    }}
                    className="bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent hover:bg-bolt-elements-button-primary-backgroundHover"
                  >
                    Try Again
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setCrawlError(null);
                      setCrawledData(null);
                      setFallbackMode(true);
                      setStep('confirm');
                    }}
                  >
                    Continue with Manual Entry
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setStep('details')}>
                    Go Back
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* BUILDING STEP */}
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
                      {generationProgress?.message || 'Sit tight while we generate your layout and copy.'}
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 p-3 text-sm">
                    {selectedTemplate ? (
                      <>
                        <div className="h-6 w-6 rounded-full bg-bolt-elements-item-backgroundAccent/10 text-bolt-elements-item-backgroundAccent flex items-center justify-center">
                          <span className="i-ph-check w-4 h-4" />
                        </div>
                        <span className="text-bolt-elements-textSecondary line-through">
                          Analyzing business details
                        </span>
                      </>
                    ) : (
                      <>
                        <div className="h-6 w-6 rounded-full border-2 border-bolt-elements-item-backgroundAccent border-t-transparent animate-spin" />
                        <span className="text-bolt-elements-textPrimary font-semibold">
                          Analyzing business details...
                        </span>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-3 rounded-lg border border-bolt-elements-borderColor bg-white p-3 text-sm">
                    {generationComplete ? (
                      <>
                        <div className="h-6 w-6 rounded-full bg-bolt-elements-item-backgroundAccent/10 text-bolt-elements-item-backgroundAccent flex items-center justify-center">
                          <span className="i-ph-check w-4 h-4" />
                        </div>
                        <span className="text-bolt-elements-textSecondary line-through">
                          Generating layout & copy...
                        </span>
                      </>
                    ) : (
                      <>
                        <div className="h-6 w-6 rounded-full border-2 border-bolt-elements-item-backgroundAccent border-t-transparent animate-spin" />
                        <span className="text-bolt-elements-textPrimary font-semibold">
                          Generating layout & copy...
                        </span>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-3 rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 p-3 text-sm opacity-70">
                    <div className="h-6 w-6 rounded-full border-2 border-bolt-elements-borderColor" />
                    <span className="text-bolt-elements-textSecondary">Final polish & SEO check</span>
                  </div>

                  {showTakingLonger && !generationComplete && (
                    <div className="text-xs text-bolt-elements-textSecondary">Taking longer than usual...</div>
                  )}

                  {selectedTemplate && (
                    <div className="text-xs text-bolt-elements-textSecondary">
                      Selected template: {selectedTemplate}
                    </div>
                  )}
                </div>

                {(generationError || error) && (
                  <div className="p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-md">
                    <p className="text-sm text-red-600 dark:text-red-400">{generationError || error}</p>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <Button
                        type="button"
                        onClick={() => {
                          // Retry generation if project exists, otherwise retry project creation
                          if (createdProject?.id) {
                            setGenerationError(null);
                            setGenerationProgress(null);
                            setSelectedTemplate(null);
                            setGeneratedFiles([]);
                            setGenerationComplete(null);
                            generationAbortRef.current?.abort();
                            generationAbortRef.current = null;
                            generationStartedAtRef.current = null;
                            setShowTakingLonger(false);
                            setGenerationAttempt((n) => n + 1);
                          } else {
                            void handleConfirm();
                          }
                        }}
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
