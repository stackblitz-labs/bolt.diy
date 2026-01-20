/**
 * Template utilities for server-side template fetching and LLM priming.
 */

export {
  fetchTemplateFromGitHub,
  applyIgnorePatterns,
  type TemplateFile,
  type FilteredTemplateFiles,
} from './github-template-fetcher';

export {
  buildTemplateFilesMessage,
  buildCustomizationMessage,
  buildTemplatePrimingMessages,
  type TemplatePrimingMessages,
} from './template-primer';
