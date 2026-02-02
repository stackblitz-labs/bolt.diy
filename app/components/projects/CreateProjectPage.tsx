import { useNavigate } from '@remix-run/react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { useProjects } from '~/lib/persistence/useProjects';
import type { BusinessData, VerifiedRestaurantData } from '~/types/crawler';
import type { CreateProjectInput, Project } from '~/types/project';
import type { GeneratedFile, GenerationProgress, GenerationResult } from '~/types/generation';
import { classNames } from '~/utils/classNames';
import { workbenchStore } from '~/lib/stores/workbench';
import { UserMenu } from '~/components/auth/UserMenu';
import { ClientOnly } from 'remix-utils/client-only';

type Step = 'details' | 'verify_search' | 'maps' | 'crawling' | 'building';

export default function CreateProjectPage() {
  const navigate = useNavigate();
  const { createProject, isLoading, total } = useProjects();
  const [step, setStep] = useState<Step>('details');

  // Basic business info
  const [businessName, setBusinessName] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [mapsUrl, setMapsUrl] = useState('');

  // Crawler state
  const [sessionId] = useState(() => crypto.randomUUID());
  const [crawlError, setCrawlError] = useState<string | null>(null);
  const [isCrawling, setIsCrawling] = useState(false);

  // Search state
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResult, setSearchResult] = useState<VerifiedRestaurantData | null>(null);

  // Markdown state (from extract API)
  const [googleMapsMarkdown, setGoogleMapsMarkdown] = useState<string | null>(null);
  const [websiteMarkdown, setWebsiteMarkdown] = useState<string | null>(null);

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

  // Progress indicator for crawling step
  const [crawlProgress, setCrawlProgress] = useState<'connecting' | 'extracting' | 'done'>('connecting');

  const [touched, setTouched] = useState({ name: false, address: false, maps: false });

  // Check project limit
  useEffect(() => {
    if (step === 'details' && total >= 10) {
      toast.error('You have reached the maximum limit of 10 projects. Please delete some projects to create new ones.');
      navigate('/app');
    }
  }, [total, navigate, step]);

  // Clean up generation on unmount
  useEffect(() => {
    return () => {
      generationAbortRef.current?.abort();
      generationAbortRef.current = null;
    };
  }, []);

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

  // Progress indicator for crawling step

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

  /*
   * Refactored: Logic to handle creating project directly
   * Used by both:
   * 1. Auto-build after successful crawl
   * 2. Manual "Create Project" from review step (fallback)
   */
  const handleAutoBuild = async (
    data: VerifiedRestaurantData,
    markdown?: { googleMaps?: string; website?: string },
  ) => {
    // Determine final values
    const finalName = data.name || businessName;
    const finalAddress = data.address || businessAddress;

    // If somehow we have no valid data (should be guarded before calling), return
    if (!finalName || !finalAddress) {
      console.error('Missing name or address for auto-build');
      return;
    }

    setStep('building');
    setGenerationError(null);
    setGenerationProgress(null);
    setSelectedTemplate(null);
    setGeneratedFiles([]);
    setGenerationComplete(null);

    /*
     * Prepare payload with markdown content
     * Use passed markdown values first (fresh from API), then fall back to state
     */
    const businessProfile = {
      session_id: sessionId,
      gmaps_url: mapsUrl.trim() || undefined,
      google_maps_markdown: markdown?.googleMaps ?? googleMapsMarkdown ?? undefined,
      website_markdown: markdown?.website ?? websiteMarkdown ?? undefined,
      crawled_at: new Date().toISOString(),
    };

    const payload: CreateProjectInput = {
      name: finalName,
      gmaps_url: mapsUrl.trim() || undefined,
      address: { line1: finalAddress },
      session_id: sessionId,
      businessProfile,
    };

    const project = await createProject(payload);

    if (!project) {
      setGenerationError('Failed to create project');
      return;
    }

    setCreatedProject(project);
  };

  const handleContinueDetails = async () => {
    setTouched((prev) => ({ ...prev, name: true, address: true }));
    setSearchError(null);

    if (!businessName.trim() || !businessAddress.trim()) {
      return;
    }

    setIsSearching(true);

    try {
      const response = await fetch('/api/crawler/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          business_name: businessName,
          address: businessAddress,
        }),
      });

      const result = (await response.json()) as {
        success?: boolean;
        data?: VerifiedRestaurantData;
        error?: { message?: string };
      };

      if (response.ok && result?.success && result?.data) {
        setSearchResult(result.data);
        setStep('verify_search');
      } else {
        const msg = result?.error?.message || 'Could not find business with those details.';
        setSearchError(msg);
      }
    } catch (err) {
      console.error('Search error:', err);
      setSearchError('Failed to connect to search service.');
    } finally {
      setIsSearching(false);
    }
  };

  const executeCrawl = async (
    payload: Partial<BusinessData> & {
      google_maps_url?: string;
      business_name?: string;
      address?: string;
      place_id?: string;
      website_url?: string;
    },
  ) => {
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
          ...payload,
        }),
      });

      const result: {
        success?: boolean;
        google_maps_markdown?: string;
        website_markdown?: string;
        has_website?: boolean;
        error?: string | { message?: string };
      } = await response.json();

      if (response.ok && result.success && result.google_maps_markdown) {
        // Store markdown from extract response (for retry scenarios)
        setGoogleMapsMarkdown(result.google_maps_markdown);
        setWebsiteMarkdown(result.website_markdown || null);

        setIsCrawling(false);

        /*
         * AUTO-PROCEED: Use searchResult for name/address (from search step)
         * Pass markdown directly to avoid React state timing issues
         */
        if (searchResult) {
          await handleAutoBuild(searchResult, {
            googleMaps: result.google_maps_markdown,
            website: result.website_markdown,
          });
        } else {
          // Fallback: should not happen in normal flow
          setCrawlError('Missing search result data');
          setStep('maps');
        }
      } else {
        const errorMessage =
          typeof result.error === 'string' ? result.error : result.error?.message || 'Failed to extract business data';
        setCrawlError(errorMessage);
        setIsCrawling(false);
        setStep('maps');
      }
    } catch (err) {
      console.error('Crawler error:', err);
      setCrawlError('Failed to connect to data extraction service. Please try again.');
      setIsCrawling(false);
      setStep('maps');
    }
  };

  const handleSubmitMaps = async () => {
    setTouched((prev) => ({ ...prev, maps: true }));

    if (!mapsUrlValid) {
      return;
    }

    // Go directly to crawling - preserve website from previous search if available
    await executeCrawl({
      google_maps_url: mapsUrl.trim(),
      website_url: searchResult?.website,
    });
  };

  const handleConfirmVerified = async () => {
    if (!searchResult) {
      setStep('maps');
      return;
    }

    // Send verified data directly - preferred method over URL construction
    await executeCrawl({
      business_name: searchResult.name,
      address: searchResult.address,
      place_id: searchResult.place_id,
      website_url: searchResult.website,
    });
  };

  const handleRejectVerified = () => {
    setStep('maps');
  };

  // Effect for generation stream
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
        const response = await fetch('/api/project/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId: createdProject.id }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          let message = `Generation request failed (${response.status})`;

          try {
            const errorData = (await response.json()) as { error?: { message?: string } };
            message = errorData?.error?.message || message;
          } catch {
            // ignore
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
              setGenerationError(payload.message ?? 'Generation failed');
            }
          } catch (parseError) {
            console.warn('[Generation] Malformed event payload:', { eventName, dataJson, parseError });
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
          return;
        }

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

  // Effect for handling completion
  useEffect(() => {
    if (!generationComplete || !createdProject || completionHandledRef.current) {
      return;
    }

    completionHandledRef.current = true;

    const run = async () => {
      const id = createdProject.url_id ?? createdProject.id;

      try {
        const filesToInject = generationComplete.files?.length ? generationComplete.files : generatedFiles;

        if (filesToInject.length > 0) {
          /*
           * Inject files into workbench - use Promise.all for speed
           * We catch individual errors to avoid breaking the whole process
           */
          await Promise.all(
            filesToInject.map((file) =>
              workbenchStore.createFile(file.path, file.content).catch((err) => {
                console.error(`Failed to inject file ${file.path}:`, err);
              }),
            ),
          );
        }

        toast.success('Website generated successfully!');
      } catch (err) {
        console.error('Completion handler encountered an error:', err);

        // We still want to navigate even if injection had a major failure
      } finally {
        // Short delay to ensure toast and state updates are processed before navigation
        setTimeout(() => {
          navigate(`/chat/${id}`);
        }, 500);
      }
    };

    void run();
  }, [createdProject, generationComplete, generatedFiles, navigate]);

  // Stepper logic
  const currentStep = useMemo(() => {
    switch (step) {
      case 'details':
      case 'verify_search':
        return 1;
      case 'maps':
      case 'crawling':
        return 2;
      case 'building':
        return 3;
      default:
        return 1;
    }
  }, [step]);

  const totalSteps = 3;
  const progressPercentage = (currentStep / totalSteps) * 100;

  return (
    <div className="min-h-screen flex flex-col antialiased selection:bg-[#21C6FF]/20 bg-[linear-gradient(135deg,#F0F8FF_0%,#F3E5F5_100%)] dark:bg-[linear-gradient(135deg,#111827_0%,#1F2937_100%)] text-[#212121] dark:text-gray-100 font-sans transition-colors duration-300">
      {/* Header */}
      <header className="absolute top-0 left-0 w-full z-50 px-6 lg:px-12 h-20 flex items-center transition-all duration-300 bg-transparent">
        <div className="w-full flex justify-between items-center relative">
          {/* Left: Logo */}
          <div className="flex items-center gap-2">
            <img src="/huskIT.svg" alt="HuskIT" className="w-[90px] inline-block" />
          </div>

          {/* Center: Stepper (Absolute Center) */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2 w-full max-w-[200px] hidden md:flex">
            <span className="text-xs font-bold tracking-widest text-[#9E9E9E] dark:text-gray-400 uppercase">
              Step {currentStep} of {totalSteps}
            </span>
            <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#1A73E8] rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>

          {/* Right: User Email & Save Exit */}
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              type="button"
              onClick={() => navigate('/app')}
              className="bg-[#1a1b26] hover:bg-black dark:bg-white dark:hover:bg-gray-200 text-white dark:text-black px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm active:scale-95"
            >
              Save & Exit
            </button>
            <div className="h-8 w-px bg-gray-200 dark:bg-gray-700 hidden sm:block mx-2"></div>
            <ClientOnly>
              {() => (
                <div className="">
                  <UserMenu className="bg-bolt-elements-background-depth-2 hover:bg-bolt-elements-background-depth-3 text-bolt-elements-textPrimary rounded-lg transition-colors" />
                </div>
              )}
            </ClientOnly>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-xl mx-auto px-4 pt-28 pb-12 sm:pb-20 flex flex-col gap-8">
        {step === 'details' && (
          <>
            <div className="text-center space-y-4">
              <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-[#212121] dark:text-white">
                Welcome!{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#21C6FF] to-blue-600">
                  Let's get started
                </span>
              </h1>
              <p className="text-lg text-[#525252] dark:text-gray-300 font-light leading-relaxed max-w-md mx-auto">
                Enter your business details below so we can start building your website.
              </p>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_10px_30px_-5px_rgba(0,0,0,0.05)] dark:shadow-none border border-white/60 dark:border-gray-800 p-6 sm:p-10 space-y-8 relative overflow-hidden transition-colors duration-300">
              <div className="absolute -top-20 -right-20 w-64 h-64 bg-[#21C6FF]/5 dark:bg-[#21C6FF]/10 rounded-full blur-3xl pointer-events-none"></div>

              <div className="space-y-6 relative z-10">
                {/* Business Name */}
                <div className="space-y-2">
                  <label
                    className="block text-xs font-bold uppercase tracking-wide text-[#9E9E9E] dark:text-gray-400 pl-1"
                    htmlFor="business-name"
                  >
                    Business Name{' '}
                    <span className="text-[#FFC000] ml-0.5 text-base align-middle" title="Required">
                      *
                    </span>
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <div className="i-ph-storefront text-[#21C6FF] text-[22px] transition-transform group-focus-within:scale-110" />
                    </div>
                    <input
                      className={classNames(
                        'w-full h-14 pl-12 pr-4 rounded-xl border border-[#9E9E9E]/30 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800 text-[#212121] dark:text-white text-base font-medium focus:ring-4 focus:ring-[#21C6FF]/15 focus:border-[#21C6FF] transition-all placeholder:text-[#9E9E9E] dark:placeholder:text-gray-500 hover:border-[#9E9E9E]/50 dark:hover:border-gray-600 outline-none',
                        nameError ? 'border-red-500 focus:border-red-500' : '',
                      )}
                      id="business-name"
                      placeholder="e.g. Bloom & Grow Studio"
                      required
                      type="text"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      onBlur={() => setTouched((prev) => ({ ...prev, name: true }))}
                    />
                  </div>
                  {nameError && <p className="text-sm text-red-500 pl-1">{nameError}</p>}
                </div>

                {/* Business Address */}
                <div className="space-y-2">
                  <label
                    className="block text-xs font-bold uppercase tracking-wide text-[#9E9E9E] dark:text-gray-400 pl-1"
                    htmlFor="business-address"
                  >
                    Business Address{' '}
                    <span className="text-[#FFC000] ml-0.5 text-base align-middle" title="Required">
                      *
                    </span>
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <div className="i-ph-map-pin text-[#21C6FF] text-[22px] transition-transform group-focus-within:scale-110" />
                    </div>
                    <input
                      className={classNames(
                        'w-full h-14 pl-12 pr-4 rounded-xl border border-[#9E9E9E]/30 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800 text-[#212121] dark:text-white text-base font-medium focus:ring-4 focus:ring-[#21C6FF]/15 focus:border-[#21C6FF] transition-all placeholder:text-[#9E9E9E] dark:placeholder:text-gray-500 hover:border-[#9E9E9E]/50 dark:hover:border-gray-600 outline-none',
                        addressError ? 'border-red-500 focus:border-red-500' : '',
                      )}
                      id="business-address"
                      placeholder="e.g. 123 Main St, New York, NY"
                      required
                      type="text"
                      value={businessAddress}
                      onChange={(e) => setBusinessAddress(e.target.value)}
                      onBlur={() => setTouched((prev) => ({ ...prev, address: true }))}
                    />
                  </div>
                  {/* Info Text */}
                  <p className="text-xs text-[#9E9E9E] dark:text-gray-400 pl-1 mt-1 flex items-center gap-1.5">
                    <div className="i-ph-info text-[16px] text-[#21C6FF]" />
                    We'll use this to find your location on maps.
                  </p>
                  {addressError && <p className="text-sm text-red-500 pl-1">{addressError}</p>}
                </div>

                {/* Error Message */}
                {searchError && (
                  <div className="p-4 rounded-xl border border-red-100 bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 text-sm flex items-start gap-3">
                    <div className="i-ph-warning-circle-bold text-lg shrink-0 mt-0.5" />
                    <p>{searchError}</p>
                  </div>
                )}

                {/* Button */}
                <div className="flex flex-col gap-3 pt-4 relative z-10">
                  <button
                    onClick={handleContinueDetails}
                    disabled={isSearching}
                    className="w-full py-4 bg-[#1A1A2E] dark:bg-[#25253E] hover:bg-[#25253E] dark:hover:bg-[#303050] text-white text-lg font-bold rounded-xl shadow-lg shadow-[#1A1A2E]/20 transition-all transform active:scale-[0.99] flex items-center justify-center gap-2 group disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {isSearching ? (
                      <>
                        <div className="i-ph-spinner-gap-bold animate-spin text-xl" />
                        Searching...
                      </>
                    ) : (
                      <>
                        Continue
                        <div className="i-ph-arrow-right text-[20px] group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* VERIFY SEARCH STEP */}
        {step === 'verify_search' && searchResult && (
          <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-soft dark:shadow-none border border-neutral-400/20 dark:border-gray-800 transition-colors duration-300 animate-in fade-in slide-in-from-bottom-4 overflow-hidden max-w-md mx-auto">
            {/* Map Preview Header */}
            <div className="h-32 bg-[#F3F4F6] dark:bg-gray-800 relative w-full overflow-hidden">
              <div
                className="absolute inset-0 opacity-10 dark:opacity-5"
                style={{
                  backgroundImage: 'radial-gradient(#9ca3af 1px, transparent 1px)',
                  backgroundSize: '20px 20px',
                }}
              ></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="i-ph-map-pin-fill text-4xl text-[#21C6FF] drop-shadow-md pb-2" />
              </div>
              <div className="absolute bottom-4 right-4 flex flex-col gap-1">
                <div className="w-8 h-8 bg-white dark:bg-gray-700 rounded-md shadow-sm flex items-center justify-center">
                  <div className="i-ph-plus text-gray-500 text-xs" />
                </div>
                <div className="w-8 h-8 bg-white dark:bg-gray-700 rounded-md shadow-sm flex items-center justify-center">
                  <div className="i-ph-minus text-gray-500 text-xs" />
                </div>
              </div>
            </div>

            <div className="p-8 pt-6 text-center">
              <h2 className="text-2xl font-bold mb-2 text-[#212121] dark:text-white">Is this your company?</h2>
              <p className="text-neutral-500 dark:text-gray-400 mb-8 font-light text-sm">
                We found a match on Google Maps based on your details.
              </p>

              <div className="p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm mb-8 text-left flex items-start gap-4">
                <div className="h-12 w-12 rounded-xl bg-[#21C6FF]/10 flex items-center justify-center shrink-0">
                  <div className="i-ph-storefront-fill text-[#21C6FF] text-2xl" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#212121] dark:text-white leading-tight">
                    {searchResult.name}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{searchResult.address}</p>
                  <div className="flex items-center gap-1.5 mt-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-[#21C6FF]" />
                    <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400">
                      Google Maps Found
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  onClick={handleConfirmVerified}
                  className="w-full py-4 bg-[#1A1A2E] dark:bg-[#25253E] hover:bg-[#25253E] dark:hover:bg-[#303050] text-white font-bold rounded-xl shadow-lg transition-all transform active:scale-[0.99] flex items-center justify-center gap-2"
                >
                  Yes, this is my business
                  <div className="i-ph-check-circle-fill text-lg" />
                </button>

                <button
                  onClick={handleRejectVerified}
                  className="w-full py-4 bg-white dark:bg-transparent border border-gray-200 dark:border-gray-700 text-[#525252] dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 font-bold rounded-xl transition-all"
                >
                  No, provide a Google Maps link
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MAPS STEP */}
        {step === 'maps' && (
          <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-soft dark:shadow-none border border-neutral-400/20 dark:border-gray-800 p-8 transition-colors duration-300">
            <h2 className="text-2xl font-bold mb-2 text-[#212121] dark:text-white">Find your business on Maps</h2>
            <p className="text-neutral-700 dark:text-gray-300 mb-6 font-light">
              Paste your Google Maps link below so we can verify your location and pull your business details
              automatically.
            </p>

            <div className="space-y-6">
              <div>
                <label
                  htmlFor="maps-link"
                  className="block text-xs font-bold uppercase tracking-wide text-[#9E9E9E] dark:text-gray-400 mb-2 pl-1"
                >
                  Google Maps Link <span className="text-[#FF4081]">*</span>
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    {mapsError || crawlError ? (
                      <div className="i-ph-link text-[#FF4081] text-[22px]" />
                    ) : (
                      <div className="i-ph-link text-[#21C6FF] text-[22px] transition-transform group-focus-within:scale-110" />
                    )}
                  </div>
                  <input
                    id="maps-link"
                    type="url"
                    value={mapsUrl}
                    onChange={(event) => {
                      setMapsUrl(event.target.value);
                      setCrawlError(null); // Clear API error on edit
                    }}
                    placeholder="https://maps.app.goo.gl/..."
                    className={classNames(
                      'w-full h-14 pl-12 pr-12 rounded-xl border bg-gray-50/50 dark:bg-gray-800 text-base font-medium transition-all outline-none',
                      mapsError || crawlError
                        ? 'border-[#FF4081] text-[#FF4081] focus:ring-4 focus:ring-[#FF4081]/15 placeholder:text-[#FF4081]/50'
                        : 'border-[#9E9E9E]/30 text-[#212121] dark:text-white focus:ring-4 focus:ring-[#21C6FF]/15 focus:border-[#21C6FF] placeholder:text-[#9E9E9E] hover:border-[#9E9E9E]/50',
                    )}
                    disabled={isLoading}
                    required
                  />
                  {(mapsError || crawlError) && (
                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                      <div className="i-ph-warning-circle-fill text-[#FF4081] text-[22px]" />
                    </div>
                  )}
                </div>
                {/* Client-side Validation Error */}
                {mapsError && !crawlError && (
                  <p className="mt-2 text-sm text-[#FF4081] font-medium pl-1">{mapsError}</p>
                )}
              </div>

              {/* API Error Alert */}
              {crawlError && (
                <div className="flex items-center justify-between gap-4 p-5 rounded-2xl border border-red-100 bg-red-50/50 dark:bg-red-900/10">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="shrink-0">
                      <div className="i-ph-warning-fill text-[#FF4081] text-2xl mt-0.5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white leading-relaxed">
                        Oops! We couldn't find a suitable business with that link.
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Please check the link and try again, or enter your details manually.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate('/app')}
                    className="shrink-0 px-5 py-2.5 bg-[#1A1A2E] hover:bg-[#25253E] text-white text-xs font-bold rounded-lg transition-colors border border-white/10"
                  >
                    Return to Dashboard
                  </button>
                </div>
              )}

              {/* Info Box (Only show if no API error) */}
              {!crawlError && (
                <div className="flex items-start gap-3 p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm">
                  <div className="shrink-0 bg-blue-50 dark:bg-blue-900/30 p-2 rounded-lg">
                    <div className="i-ph-lightbulb-fill text-[#21C6FF] text-xl" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white">Where to find your link?</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                      Go to{' '}
                      <a
                        href="https://maps.google.com"
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#21C6FF] hover:underline font-medium"
                      >
                        Google Maps
                      </a>
                      , search for your business, click the{' '}
                      <span className="font-bold text-gray-700 dark:text-gray-300">Share</span> icon, and copy the link
                      provided.
                    </p>
                  </div>
                </div>
              )}

              {/* Buttons */}
              <div className="flex flex-col gap-3 sm:flex-row pt-2">
                {crawlError ? (
                  <button
                    type="button"
                    onClick={handleSubmitMaps}
                    className="w-full py-3.5 bg-[#21C6FF] hover:bg-[#1bb1e6] text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
                  >
                    Retry Submission
                    <div className="i-ph-arrow-clockwise-bold text-lg" />
                  </button>
                ) : (
                  <>
                    {/* Normal State Buttons */}
                    <button
                      type="button"
                      onClick={() => setStep('details')}
                      className="flex-1 py-3.5 bg-white dark:bg-transparent border border-[#9E9E9E]/30 dark:border-gray-700 text-[#525252] dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 font-bold rounded-xl transition-all"
                    >
                      Go Back
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmitMaps}
                      className="flex-1 py-3.5 bg-[#FFC000] hover:bg-[#FFD000] text-black font-extrabold rounded-xl shadow-lg shadow-yellow-500/20 transition-transform active:scale-[0.99] flex items-center justify-center gap-2"
                    >
                      Submit Link
                      <div className="i-ph-arrow-right-bold text-lg" />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Placeholder for other steps */}
        {['crawling', 'building'].includes(step) && (
          <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-soft dark:shadow-none border border-neutral-400/20 dark:border-gray-800 p-8 transition-colors duration-300">
            {step === 'crawling' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="text-center space-y-4">
                  <div className="relative h-24 w-24 mx-auto mb-6">
                    <div className="absolute inset-0 rounded-full border-4 border-[#21C6FF]/10 dark:border-[#21C6FF]/5" />
                    <div className="absolute inset-0 rounded-full border-4 border-[#21C6FF] border-t-transparent animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="i-ph-google-maps-logo-fill text-3xl text-[#21C6FF] animate-pulse" />
                    </div>
                  </div>
                  <h2 className="text-2xl font-bold text-[#212121] dark:text-white">Extracting business data...</h2>
                  <p className="text-[#525252] dark:text-gray-300 max-w-sm mx-auto">
                    Please wait while we gather information from Google Maps. This usually takes 10-30 seconds.
                  </p>
                </div>

                <div className="space-y-4 max-w-sm mx-auto">
                  <div className="flex items-center gap-3">
                    <div
                      className={classNames(
                        'h-2 w-2 rounded-full',
                        crawlProgress === 'connecting' ? 'bg-[#21C6FF] animate-ping' : 'bg-green-500',
                      )}
                    />
                    <span
                      className={classNames(
                        'text-sm font-medium',
                        crawlProgress === 'connecting' ? 'text-[#212121] dark:text-white' : 'text-gray-400',
                      )}
                    >
                      Connecting to Google Maps
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div
                      className={classNames(
                        'h-2 w-2 rounded-full',
                        crawlProgress === 'extracting'
                          ? 'bg-[#21C6FF] animate-ping'
                          : crawlProgress === 'done'
                            ? 'bg-green-500'
                            : 'bg-gray-200',
                      )}
                    />
                    <span
                      className={classNames(
                        'text-sm font-medium',
                        crawlProgress === 'extracting'
                          ? 'text-[#212121] dark:text-white'
                          : crawlProgress === 'done'
                            ? 'text-gray-400'
                            : 'text-gray-200',
                      )}
                    >
                      Extracting business information
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div
                      className={classNames(
                        'h-2 w-2 rounded-full',
                        crawlProgress === 'done' ? 'bg-[#21C6FF] animate-ping' : 'bg-gray-200',
                      )}
                    />
                    <span
                      className={classNames(
                        'text-sm font-medium',
                        crawlProgress === 'done' ? 'text-[#212121] dark:text-white' : 'text-gray-200',
                      )}
                    >
                      Finalizing results
                    </span>
                  </div>
                </div>
              </div>
            )}

            {step === 'building' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="text-center space-y-4">
                  <div className="relative h-24 w-24 mx-auto mb-6">
                    <div className="absolute inset-0 rounded-full border-4 border-[#21C6FF]/10 dark:border-[#21C6FF]/5" />
                    <div className="absolute inset-0 rounded-full border-4 border-[#21C6FF] border-t-transparent animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="i-ph-magic-wand-fill text-3xl text-[#21C6FF] animate-pulse" />
                    </div>
                  </div>
                  <h2 className="text-3xl font-extrabold text-[#212121] dark:text-white">Building your website</h2>
                  <p className="text-[#525252] dark:text-gray-300 max-w-sm mx-auto">
                    {generationProgress?.message ||
                      'Our AI is setting everything up for you. Sit tight while we generate your layout and copy.'}
                  </p>
                </div>

                <div className="space-y-3 max-w-md mx-auto">
                  {/* Phase 1: Analyzing */}
                  <div
                    className={classNames(
                      'flex items-center gap-3 p-4 rounded-2xl border transition-all duration-300',
                      selectedTemplate
                        ? 'bg-green-50/50 dark:bg-green-500/5 border-green-100 dark:border-green-500/10 opacity-70'
                        : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm',
                    )}
                  >
                    <div
                      className={classNames(
                        'h-10 w-10 rounded-full flex items-center justify-center shrink-0',
                        selectedTemplate
                          ? 'bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400'
                          : 'bg-[#21C6FF]/10 text-[#21C6FF]',
                      )}
                    >
                      {selectedTemplate ? (
                        <div className="i-ph-check-bold text-xl" />
                      ) : (
                        <div className="i-ph-magnifying-glass-bold text-xl animate-pulse" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p
                        className={classNames(
                          'font-bold text-sm',
                          selectedTemplate ? 'text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-white',
                        )}
                      >
                        Analyzing business details
                      </p>
                      {selectedTemplate && (
                        <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">
                          Template selected: {selectedTemplate}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Phase 2: Generating */}
                  <div
                    className={classNames(
                      'flex items-center gap-3 p-4 rounded-2xl border transition-all duration-300',
                      generationComplete
                        ? 'bg-green-50/50 dark:bg-green-500/5 border-green-100 dark:border-green-500/10 opacity-70'
                        : !selectedTemplate
                          ? 'bg-gray-50 dark:bg-gray-900/50 border-gray-100 dark:border-gray-800 opacity-50'
                          : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm',
                    )}
                  >
                    <div
                      className={classNames(
                        'h-10 w-10 rounded-full flex items-center justify-center shrink-0',
                        generationComplete
                          ? 'bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400'
                          : selectedTemplate
                            ? 'bg-[#21C6FF]/10 text-[#21C6FF]'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-400',
                      )}
                    >
                      {generationComplete ? (
                        <div className="i-ph-check-bold text-xl" />
                      ) : selectedTemplate ? (
                        <div className="i-ph-browsers-bold text-xl animate-pulse" />
                      ) : (
                        <div className="i-ph-browsers-bold text-xl" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p
                        className={classNames(
                          'font-bold text-sm',
                          generationComplete
                            ? 'text-gray-500 dark:text-gray-400'
                            : !selectedTemplate
                              ? 'text-gray-400'
                              : 'text-gray-900 dark:text-white',
                        )}
                      >
                        Generating layout & copy
                      </p>
                      {generatedFiles.length > 0 && !generationComplete && (
                        <div className="mt-2 h-1.5 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#21C6FF] rounded-full transition-all duration-500"
                            style={{
                              width: `${generationComplete ? 100 : (generationProgress?.percentage ?? Math.min(generatedFiles.length * 10, 95))}%`,
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Phase 3: Finalizing */}
                  <div
                    className={classNames(
                      'flex items-center gap-3 p-4 rounded-2xl border transition-all duration-300',
                      generationComplete
                        ? 'bg-green-50/50 dark:bg-green-500/5 border-green-100 dark:border-green-500/10 opacity-70'
                        : 'bg-gray-50 dark:bg-gray-900/50 border-gray-100 dark:border-gray-800 opacity-50',
                    )}
                  >
                    <div
                      className={classNames(
                        'h-10 w-10 rounded-full flex items-center justify-center shrink-0',
                        generationComplete
                          ? 'bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-400',
                      )}
                    >
                      {generationComplete ? (
                        <div className="i-ph-check-bold text-xl" />
                      ) : (
                        <div className="i-ph-sparkle-bold text-xl" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p
                        className={classNames(
                          'font-bold text-sm',
                          generationComplete ? 'text-gray-500 dark:text-gray-400' : 'text-gray-400',
                        )}
                      >
                        Final polish & SEO check
                      </p>
                    </div>
                  </div>

                  {showTakingLonger && !generationComplete && (
                    <div className="bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/20 p-4 rounded-2xl text-center">
                      <p className="text-xs text-blue-600 dark:text-blue-400">
                        This is taking a bit longer than usual, but we're still working on it.
                      </p>
                    </div>
                  )}
                </div>

                {generationError && (
                  <div className="max-w-md mx-auto p-6 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 rounded-3xl space-y-4">
                    <div className="flex items-start gap-4">
                      <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                        <div className="i-ph-warning-bold text-xl" />
                      </div>
                      <div>
                        <p className="font-bold text-red-900 dark:text-white">Something went wrong</p>
                        <p className="text-sm text-red-600 dark:text-red-400 mt-1">{generationError}</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => {
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
                            if (searchResult) {
                              void handleAutoBuild(searchResult);
                            } else {
                              void handleAutoBuild({
                                name: businessName,
                                address: businessAddress,
                              } as VerifiedRestaurantData);
                            }
                          }
                        }}
                        className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors"
                      >
                        Try Again
                      </button>
                      <button
                        onClick={() => navigate('/app')}
                        className="flex-1 py-3 border border-red-200 text-red-600 font-bold rounded-xl hover:bg-red-50 transition-colors"
                      >
                        Exit
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
