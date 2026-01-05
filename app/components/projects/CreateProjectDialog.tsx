import React, { useEffect, useMemo, useState } from 'react';
import { DialogRoot, Dialog, DialogTitle, DialogDescription } from '~/components/ui/Dialog';
import { Input } from '~/components/ui/Input';
import { Button } from '~/components/ui/Button';
import type { CreateProjectInput } from '~/types/project';
import type { BusinessData, GeneratedContent } from '~/types/crawler';

interface CreateProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateProject: (input: CreateProjectInput) => Promise<void>;
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
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Review/edit state
  const [editedName, setEditedName] = useState('');
  const [editedAddress, setEditedAddress] = useState('');
  const [editedPhone, setEditedPhone] = useState('');
  const [editedWebsite, setEditedWebsite] = useState('');
  const [showHours, setShowHours] = useState(false);

  // Progress indicator for crawling step
  const [crawlProgress, setCrawlProgress] = useState<'connecting' | 'extracting' | 'done'>('connecting');

  const [touched, setTouched] = useState({ name: false, address: false, maps: false });

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
    }
  }, [isOpen]);

  // Auto-close after successful project creation
  useEffect(() => {
    if (step === 'building' && !isLoading && !error) {
      const timer = window.setTimeout(() => {
        onClose();
      }, 1200);
      return () => window.clearTimeout(timer);
    }

    return undefined;
  }, [step, isLoading, error, onClose]);

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

    // Skip AI generation in fallback mode
    if (fallbackMode) {
      const payload: CreateProjectInput = {
        name: businessName.trim(),
        gmaps_url: mapsUrl.trim() || undefined,
        address: { line1: businessAddress.trim() },
        session_id: sessionId,
      };

      await onCreateProject(payload);

      return;
    }

    // Call AI generation if we have crawled data
    let finalGeneratedContent: GeneratedContent | null = generatedContent;

    if (crawledData && !generatedContent) {
      setIsGenerating(true);

      try {
        const response = await fetch('/api/crawler/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            session_id: sessionId,
          }),
        });

        const result: { success?: boolean; data?: GeneratedContent; error?: string | { message?: string } } =
          await response.json();

        if (response.ok && result.success && result.data) {
          finalGeneratedContent = result.data;
          setGeneratedContent(result.data);
          setIsGenerating(false);
        } else {
          const errorMessage =
            typeof result.error === 'string' ? result.error : result.error?.message || 'Failed to generate content';
          setGenerationError(errorMessage);
          setIsGenerating(false);

          // Still proceed to project creation even if generation failed
          console.error('AI generation failed:', errorMessage);
        }
      } catch (err) {
        console.error('Generation error:', err);
        setGenerationError('Failed to generate AI content. Continuing with basic data.');
        setIsGenerating(false);
      }
    }

    // Construct business profile with the generated content from API response
    const businessProfile =
      crawledData || finalGeneratedContent
        ? {
            session_id: sessionId,
            gmaps_url: mapsUrl.trim() || undefined,
            crawled_data: crawledData || undefined,
            generated_content: finalGeneratedContent || undefined,
            crawled_at: new Date().toISOString(),
          }
        : undefined;

    const payload: CreateProjectInput = {
      name: businessName.trim(),
      gmaps_url: mapsUrl.trim() || undefined,
      address: { line1: businessAddress.trim() },
      session_id: sessionId,
      businessProfile,
    };

    await onCreateProject(payload);
  };

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
              <DialogTitle>{fallbackMode ? 'Creating your project...' : 'Building your website'}</DialogTitle>
              <DialogDescription>
                {fallbackMode
                  ? 'Please wait while we set up your project.'
                  : 'Our AI is setting everything up for you.'}
              </DialogDescription>
              <div className="mt-6 space-y-6">
                <div className="flex flex-col items-center gap-4 text-center">
                  <div className="relative h-24 w-24">
                    <div className="absolute inset-0 rounded-full border-4 border-bolt-elements-borderColor" />
                    <div className="absolute inset-0 rounded-full border-4 border-bolt-elements-item-backgroundAccent border-t-transparent animate-spin" />
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-bolt-elements-textPrimary">
                      {fallbackMode ? 'Creating your project' : 'Building your dream website'}
                    </div>
                    <div className="text-sm text-bolt-elements-textSecondary">
                      {fallbackMode
                        ? 'This will only take a moment.'
                        : isGenerating
                          ? 'Generating AI-powered content...'
                          : 'Sit tight while we generate your layout and copy.'}
                    </div>
                  </div>
                </div>
                {!fallbackMode && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 p-3 text-sm">
                      <div className="h-6 w-6 rounded-full bg-bolt-elements-item-backgroundAccent/10 text-bolt-elements-item-backgroundAccent flex items-center justify-center">
                        <span className="i-ph-check w-4 h-4" />
                      </div>
                      <span className="text-bolt-elements-textSecondary line-through">Analyzing business details</span>
                    </div>
                    <div className="flex items-center gap-3 rounded-lg border border-bolt-elements-borderColor bg-white p-3 text-sm">
                      {isGenerating ? (
                        <>
                          <div className="h-6 w-6 rounded-full border-2 border-bolt-elements-item-backgroundAccent border-t-transparent animate-spin" />
                          <span className="text-bolt-elements-textPrimary font-semibold">
                            Generating layout & copy...
                          </span>
                        </>
                      ) : (
                        <>
                          <div className="h-6 w-6 rounded-full bg-bolt-elements-item-backgroundAccent/10 text-bolt-elements-item-backgroundAccent flex items-center justify-center">
                            <span className="i-ph-check w-4 h-4" />
                          </div>
                          <span className="text-bolt-elements-textSecondary line-through">
                            Generating layout & copy...
                          </span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-3 rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 p-3 text-sm opacity-70">
                      <div className="h-6 w-6 rounded-full border-2 border-bolt-elements-borderColor" />
                      <span className="text-bolt-elements-textSecondary">Final polish & SEO check</span>
                    </div>
                  </div>
                )}
                {generationError && !error && (
                  <div className="p-3 bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20 rounded-md">
                    <p className="text-sm text-orange-600 dark:text-orange-400">
                      AI generation completed with warnings. Your project will be created with available data.
                    </p>
                  </div>
                )}
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
