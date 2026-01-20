// Describes all the reference apps that can be used for customization
// during app building.

import { callNutAPI } from './NutAPI';

// Placeholder image URL for reference apps without a screenshot
export const REFERENCE_APP_PLACEHOLDER_PHOTO = 'https://placehold.co/800x450/1e293b/94a3b8?text=No+Photo';

// Release stage of a reference app.
export enum ReferenceAppStage {
  Alpha = 'Alpha',
  Beta = 'Beta',
  Release = 'Release',
}

// Tags for broadly categorizing reference apps.
enum ReferenceAppTag {
  Business = 'Business',
  Technical = 'Technical',
  Personal = 'Personal',
  Social = 'Social',
}

export interface LandingPageIndexEntry {
  referenceAppPath: string;
  stage: ReferenceAppStage;
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

// Data stored at the landingPageURL for a reference app.
export interface LandingPageContent {
  // Path to the reference app relative to the referenceApps/ directory.
  referenceAppPath: string;

  // Release stage of the reference app.
  stage: ReferenceAppStage;

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

export async function getLandingPageIndex(): Promise<LandingPageIndexEntry[]> {
  const { landingPages } = await callNutAPI('get-landing-page-index', {});
  return landingPages;
}

export async function getLandingPageContent(referenceAppPath: string): Promise<LandingPageContent> {
  const { landingPage } = await callNutAPI('get-landing-page', { referenceAppPath });
  return landingPage;
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
