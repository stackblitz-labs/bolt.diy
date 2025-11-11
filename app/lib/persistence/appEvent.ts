// An AppEvent is a JSON-serializable object describing progress made by a chat
// that is developing an app. Events use a structured format to make things easier
// for displaying in the frontend.
//
// Each AppEvent is sent to the client as a response indicating the chat which
// produced the event, the time and so on.

interface AppEventStartFeature {
  name: 'start-feature';
  featureName: string;
  why: 'implement' | 'validate';
}

interface AppEventRunTests {
  name: 'run-tests';
}

interface AppEventsTestFailure {
  name: 'test-failure';
  title?: string;
  recordingId?: string;
}

interface AppEventAnalyzeTestFailure {
  name: 'analyze-test-failure';
}

interface AppEventFixTestFailure {
  name: 'fix-test-failure';
}

interface AppEventMergeChanges {
  name: 'merge-changes';
}

interface AppEventResolveMergeConflict {
  name: 'resolve-merge-conflict';
}

interface AppEventLandChanges {
  name: 'land-changes';
  iteration: number;
  oldRepositoryId: string;
  newRepositoryId: string;
}

export type AppEvent =
  | AppEventStartFeature
  | AppEventRunTests
  | AppEventsTestFailure
  | AppEventAnalyzeTestFailure
  | AppEventFixTestFailure
  | AppEventMergeChanges
  | AppEventResolveMergeConflict
  | AppEventLandChanges;
