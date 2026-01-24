// Describes all the reference apps that can be used for customization
// during app building.

import { callNutAPI } from './NutAPI';

// Placeholder image URL for reference apps without a screenshot
export const REFERENCE_APP_PLACEHOLDER_PHOTO = 'https://placehold.co/800x450/1e293b/94a3b8?text=No+Photo';

// Tags for broadly categorizing reference apps.
enum ReferenceAppTag {
  Business = 'Business',
  Technical = 'Technical',
  Personal = 'Personal',
  Social = 'Social',
}

interface LandingPageIndexEntry {
  referenceAppPath: string;
  tags: ReferenceAppTag[];
  name: string;
  shortDescription: string;
  bulletPoints: string[];
  screenshotURL: string | undefined;
}

// A kind of feature which can be in the landing page content.
enum LandingPageFeatureKind {
  // Show a page of the app and its functionality.
  Page = 'Page',

  // Integration with an external service.
  Integration = 'Integration',
}

interface LandingPageFeature {
  // The kind of feature.
  kind: LandingPageFeatureKind;

  // A few words describing the feature.
  name: string;

  // Single paragraph (3 sentences at most) describing the feature.
  description: string;

  // Names of any screenshot / video artifacts for the feature.
  // See writingTests/GenerateArtifacts.md.
  artifactNames?: string[];

  // Names are converted to URLs when writing to S3.
  artifactURLs?: string[];
}

interface LandingPageContent {
  // Path to the reference app relative to the referenceApps/ directory.
  referenceAppPath: string;

  // All tags on the reference app.
  tags: ReferenceAppTag[];

  // Name of the app.
  name: string;

  // A single phrase describing the main purpose of the app.
  shortDescription: string;

  // At most three short bullet points for key features of the app.
  bulletPoints?: string[];

  // Single paragraph (5 sentences at most) describing the overall purpose of the app.
  longDescription: string;

  // Features which can be described on a landing page.
  features: LandingPageFeature[];

  // Artifact name to feature most prominently for the app.
  mainArtifactName: string;
}

export type ReferenceAppStage = 'not_tested' | 'broken' | 'alpha' | 'beta' | 'release';

export interface ReferenceAppSummary extends LandingPageIndexEntry {
  stage: ReferenceAppStage;
}

const AppTrackerHost = 'https://builder-reference-app-tracker.netlify.app';

type WebhookGetAppPathsResponse = Array<{ path: string; stage: ReferenceAppStage }>;

async function fetchTrackerAppPaths(): Promise<WebhookGetAppPathsResponse> {
  const appPaths = await fetch(`${AppTrackerHost}/.netlify/functions/WebhookGetAppPaths`);
  return appPaths.json();
}

export async function getReferenceAppSummaries(): Promise<ReferenceAppSummary[]> {
  const appPathsPromise = fetchTrackerAppPaths();

  const { landingPages } = (await callNutAPI('get-landing-page-index', {})) as {
    landingPages: LandingPageIndexEntry[];
  };
  const appPaths = await appPathsPromise;

  return landingPages.map((landingPage: LandingPageIndexEntry) => {
    const pathEntry = appPaths.find((appPath) => appPath.path === landingPage.referenceAppPath);
    const stage = pathEntry?.stage ?? 'not_tested';
    return {
      ...landingPage,
      stage,
    };
  });
}

interface ReferenceAppFeature {
  name: string;
  status: 'green' | 'yellow' | 'red';
  note?: string;
}

interface ReferenceAppBug {
  description: string;
}

interface ReferenceAppReview {
  rating: number; // 1-5
  name?: string;
  comment?: string;
}

export interface ReferenceAppContent extends LandingPageContent {
  stage: ReferenceAppStage;
  trackerFeatures: ReferenceAppFeature[];
  trackerBugs: ReferenceAppBug[];
  trackerCopyCount: number;
  trackerReviews: ReferenceAppReview[];
}

interface WebhookGetAppDataResponse {
  stage: ReferenceAppStage;
  features: ReferenceAppFeature[];
  bugs: ReferenceAppBug[];
  copyCount: number;
  reviews: ReferenceAppReview[];
}

async function fetchTrackerAppData(referenceAppPath: string): Promise<WebhookGetAppDataResponse> {
  const appData = await fetch(`${AppTrackerHost}/.netlify/functions/WebhookGetAppData`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ path: referenceAppPath }),
  });
  return appData.json();
}

export async function getReferenceAppContent(referenceAppPath: string): Promise<ReferenceAppContent> {
  const appDataPromise = fetchTrackerAppData(referenceAppPath);

  const { landingPage } = (await callNutAPI('get-landing-page', { referenceAppPath })) as {
    landingPage: LandingPageContent;
  };

  const appData = await appDataPromise;
  return {
    ...landingPage,
    stage: appData.stage,
    trackerFeatures: appData.features,
    trackerBugs: appData.bugs,
    trackerCopyCount: appData.copyCount,
    trackerReviews: appData.reviews,
  };
}

export async function reportTrackerAppCopy(
  referenceAppPath: string,
  type: 'download' | 'customize',
  email: string | undefined,
) {
  await fetch(`${AppTrackerHost}/.netlify/functions/WebhookReportAppCopy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ path: referenceAppPath, type, user_email: email }),
  });
}

interface WebhookAddAppReviewRequest {
  path: string;
  rating: number; // 1-5
  user_name?: string;
  user_email?: string;
  comment?: string;
}

export async function addTrackerAppReview(request: WebhookAddAppReviewRequest) {
  await fetch(`${AppTrackerHost}/.netlify/functions/WebhookAddAppReview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
}

// Abbreviated information about a collection page.
export interface CollectionPageIndexEntry {
  collectionPath: string;
  name: string;
  shortDescription: string;
}

// Information about a reference app in a collection.
interface CollectionPageReferenceApp {
  // Path under the referenceApps directory to this app.
  referenceAppPath: string;

  // Description of the app tailored to the collection's use case.
  description: string;
}

export interface CollectionPageContent {
  // Identifying path under the collections directory to this content JSON file.
  // directories are lower case, collection file names are PascalCase.
  collectionPath: string;

  // Name of the collection.
  name: string;

  // Single phrase describing the collection, e.g. the persona who the collection is for.
  shortDescription: string;

  // Single paragraph (5 sentences at most) with details about the problems the collection of apps is designed to solve.
  longDescription: string;

  // All apps in the collection, in the order they should be presented.
  apps: CollectionPageReferenceApp[];
}

export async function getCollections(): Promise<CollectionPageIndexEntry[]> {
  const { collectionPages } = await callNutAPI('get-collection-page-index', {});
  return collectionPages;
}

export async function getCollectionPageContent(collectionPath: string): Promise<CollectionPageContent> {
  const { collectionPage } = await callNutAPI('get-collection-page', { collectionPath });
  return collectionPage;
}
