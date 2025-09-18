// Routines for parsing the current state of the app from backend messages.

import { assert } from '~/utils/nut';
import type { Message } from './message';
import type { DatabaseSchema } from './databaseSchema';

// Message sent whenever the app summary is updated.
export const APP_SUMMARY_CATEGORY = 'AppSummary';

export enum PlaywrightTestStatus {
  Pass = 'Pass',
  Fail = 'Fail',
  NotRun = 'NotRun',
}

// Details of the app have a short name and a one sentence description.
export interface AppDetail {
  name: string;
  description: string;
}

// Describes the contents of a page in the app.
export interface AppPage {
  // Short name for the page. 7/24/2025: Older apps don't have this.
  name?: string;

  // Path to this page in the app. '/' for the root page, may include wildcards.
  path: string;

  // One sentence description of the page.
  description: string;

  // All components on the page. Name is the component class or function name.
  components: AppDetail[];
}

// Kinds of APIs a feature can define or use.
export enum AppAPIKind {
  // A serverless function which is defined in the backend and called by the frontend.
  ServerlessFunction = 'ServerlessFunction',

  // A function defined in library code and called by frontend components.
  Frontend = 'Frontend',

  // A function defined in library code and called by backend functions.
  Backend = 'Backend',
}

// An API defined or used by a feature.
export interface AppAPI extends AppDetail {
  kind: AppAPIKind;
}

// The status of a feature describes its implementation and whether associated components
// should be functional.
export enum AppFeatureStatus {
  // Not started, all components will be non-functional.
  NotStarted = 'NotStarted',

  // Implementation has started on implementing the feature's functionality.
  ImplementationInProgress = 'ImplementationInProgress',

  // Functionality has been implemented but the app has not been validated.
  Implemented = 'Implemented',

  // Validation has started to test the feature's functionality.
  ValidationInProgress = 'ValidationInProgress',

  // Validation has completed and all tests pass. The feature should be functional.
  Validated = 'Validated',

  // The feature is implemented but we've given up on validating it.
  ValidationFailed = 'ValidationFailed',
}

export enum AppFeatureKind {
  // Build the app's mockup.
  BuildMockup = 'BuildMockup',

  // Initial design work for the database and backend/reducer APIs.
  DesignAPIs = 'DesignAPIs',

  // Build the backend and components for the first functional version of the app.
  BuildInitialApp = 'BuildInitialApp',

  // Write one or more integration tests and get them to pass.
  IntegrationTests = 'IntegrationTests',
}

export interface AppFeature {
  // Short name for the feature.
  name: string;

  // Kind of feature.
  kind?: AppFeatureKind;

  // Current status of the feature.
  status: AppFeatureStatus;

  // Time when this feature was created. 2025/8/30: Always present in newer apps.
  time?: string;

  // Any existing feature in the Arboretum which will be used to implement this one.
  arboretumRepositoryId?: string;

  // One sentence description of the feature.
  description: string;

  // One paragraph summary of the feature's requirements.
  summary: string;

  // Names of any components which the feature implements.
  componentNames?: string[];

  // Any APIs defined by other features and used by this feature.
  usedAPIs?: AppAPI[];

  // Any APIs defined by this feature.
  definedAPIs?: AppAPI[];

  // Any database changes needed by the feature.
  databaseChange?: DatabaseSchema;

  // Any secrets required by backend APIs in the feature.
  // Names are environment variables.
  secrets?: AppDetail[];

  // Tests for functionality added by the feature.
  tests?: AppTest[];
}

// Describes a planned or implemented playwright test.
export interface AppTest {
  title: string;

  // Set after the test has been implemented.
  status?: PlaywrightTestStatus;

  // Any recording from the last time the test ran.
  recordingId?: string;
}

export enum AppUpdateReasonKind {
  DescribeLayout = 'DescribeLayout',
  DescribeFeatures = 'DescribeFeatures',
  StartImplementFeature = 'StartImplementFeature',
  StartValidateFeature = 'StartValidateFeature',
  FeatureImplemented = 'FeatureImplemented',
  FeatureValidated = 'FeatureValidated',
  MockupValidated = 'MockupValidated',
  RevertApp = 'RevertApp',
  CopyApp = 'CopyApp',
}

// Describes why the app's summary was updated.
export interface AppUpdateReason {
  kind: AppUpdateReasonKind;

  // Any feature associated with the update.
  featureName?: string;

  // For RevertApp, the iteration the summary was reverted to.
  iteration?: number;

  // For CopyApp, the appId of the app which was copied.
  appId?: string;
}

export interface AppSummary {
  // Short and high level description of the app.
  description: string;

  pages?: AppPage[];
  navigation?: string;
  features?: AppFeature[];
  otherTests?: AppTest[];
  setSecrets?: string[];

  // The repository being described, if available.
  repositoryId?: string;

  // Version of the main app template the repository uses.
  templateVersion?: string;

  // Version string of the repository: Major.Minor.Patch
  // The version advances every time the app changes.
  version?: string;

  iteration: number;
  time: string;
  chatId?: string;
  reason?: AppUpdateReason;
}

export function parseAppSummaryMessage(message: Message): AppSummary | undefined {
  try {
    assert(message.category === APP_SUMMARY_CATEGORY, 'Message is not an app summary message');
    assert(message.type === 'text', 'Message is not a text message');
    const appSummary = JSON.parse(message.content) as AppSummary;
    assert(typeof appSummary.description === 'string', 'Missing app description');
    assert(Array.isArray(appSummary.pages), 'Missing app pages');
    return appSummary;
  } catch (e) {
    console.error('Failed to parse app summary message', e);
    return undefined;
  }
}

export function isFeatureStatusImplemented(status?: AppFeatureStatus) {
  return status && status != AppFeatureStatus.NotStarted && status != AppFeatureStatus.ImplementationInProgress;
}
