// Describes all the reference apps that can be used for customization
// during app building.

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
  landingPageURL: string;
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

export async function fetchReferenceApps(): Promise<LandingPageIndexEntry[]> {
  const response = await fetch('https://static.replay.io/test-artifacts/LandingPageIndex.json');
  return response.json();
}

export async function fetchReferenceAppLandingPage(landingPageURL: string): Promise<LandingPageContent> {
  const response = await fetch(landingPageURL);
  return response.json();
}
