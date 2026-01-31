/**
 * Template utilities for server-side template fetching and LLM priming.
 */

// GitHub template fetcher
export {
  fetchTemplateFromGitHub,
  applyIgnorePatterns,
  type TemplateFile,
  type FilteredTemplateFiles,
} from './github-template-fetcher';

// Template primer for LLM context
export {
  buildTemplateFilesMessage,
  buildCustomizationMessage,
  buildTemplatePrimingMessages,
  type TemplatePrimingMessages,
} from './template-primer';

// Zip template fetcher
export {
  fetchTemplateFromZip,
  templateNameToZipFilename,
  getZipPath,
  zipExists,
  ZipTemplateError,
  type ZipExtractionResult,
  type ZipFetcherOptions,
  type SkippedFile,
  type ZipTemplateErrorCode,
} from './zip-template-fetcher';

// Unified template resolver
export {
  resolveTemplate,
  canAccessFileSystem,
  resetFsAvailabilityCache,
  type ResolvedTemplate,
  type TemplateSource,
  type TemplateResolverOptions,
} from './template-resolver';
