/**
 * File Change Optimizer
 * PhD-level implementation to prevent unnecessary file rewrites
 * Ensures LLM only modifies files that actually need changes
 */

import { createScopedLogger } from '~/utils/logger';
import type { FileMap } from '~/lib/stores/files';
import { diffLines, createPatch } from 'diff';

const logger = createScopedLogger('FileChangeOptimizer');

export interface FileChangeAnalysis {
  needsChange: boolean;
  reason: string;
  changeType: 'create' | 'modify' | 'delete' | 'skip';
  similarity: number;
  hasSignificantChanges: boolean;
  changeMetrics: {
    linesAdded: number;
    linesRemoved: number;
    linesModified: number;
    totalChanges: number;
    changePercentage: number;
  };
  suggestions?: string[];
  requiredDependencies?: string[];
  impactedFiles?: string[];
}

export interface OptimizationResult {
  optimizedFiles: FileMap;
  skippedFiles: string[];
  modifiedFiles: string[];
  createdFiles: string[];
  deletedFiles: string[];
  analysis: Map<string, FileChangeAnalysis>;
  totalSaved: number;
  optimizationRate: number;
  logs: OptimizationLog[];
}

export interface OptimizationLog {
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  details?: any;
}

export interface FileContext {
  userRequest: string;
  previousContent?: string;
  newContent: string;
  filePath: string;
  fileType: string;
  dependencies?: string[];
  relatedFiles?: string[];
}

export class FileChangeOptimizer {
  private _logs: OptimizationLog[] = [];
  private _fileHashes: Map<string, string> = new Map();
  private _dependencyGraph: Map<string, Set<string>> = new Map();
  private _changeHistory: Map<string, FileChangeAnalysis[]> = new Map();

  // Thresholds for optimization
  private readonly _similarityThreshold = 0.95; // 95% similar = skip
  private readonly _minimalChangeThreshold = 0.02; // Less than 2% change = skip
  private readonly _whitespaceOnlyPattern = /^[\s\n\r\t]*$/;
  private readonly _commentOnlyPattern = /^(\s*\/\/.*|\s*\/\*[\s\S]*?\*\/|\s*#.*|\s*<!--[\s\S]*?-->)*$/;

  constructor() {
    this._log('info', 'FileChangeOptimizer initialized with PhD-level optimization algorithms');
  }

  /**
   * Main optimization entry point - analyzes and optimizes file changes
   */
  async optimizeFileChanges(
    proposedChanges: FileMap,
    existingFiles: FileMap,
    userRequest: string,
  ): Promise<OptimizationResult> {
    this._log('info', `Starting optimization for ${Object.keys(proposedChanges).length} proposed file changes`);
    this._log('debug', `User request: "${userRequest}"`);

    const result: OptimizationResult = {
      optimizedFiles: {},
      skippedFiles: [],
      modifiedFiles: [],
      createdFiles: [],
      deletedFiles: [],
      analysis: new Map(),
      totalSaved: 0,
      optimizationRate: 0,
      logs: [...this._logs],
    };

    // Extract intent from user request
    const userIntent = this._analyzeUserIntent(userRequest);
    this._log('debug', 'User intent analysis', userIntent);

    // Process each proposed file change
    for (const [filePath, proposedDirent] of Object.entries(proposedChanges)) {
      // Extract content from Dirent
      const proposedContent = proposedDirent?.type === 'file' ? proposedDirent.content : '';
      const existingDirent = existingFiles[filePath];
      const existingContent = existingDirent?.type === 'file' ? existingDirent.content : undefined;

      const context: FileContext = {
        userRequest,
        previousContent: existingContent,
        newContent: proposedContent,
        filePath,
        fileType: this._getFileType(filePath),
        dependencies: this._extractDependencies(proposedContent || '', filePath),
        relatedFiles: this._findRelatedFiles(filePath, existingFiles),
      };

      const analysis = await this._analyzeFileChange(context, userIntent);
      result.analysis.set(filePath, analysis);

      this._log('debug', `Analysis for ${filePath}`, {
        needsChange: analysis.needsChange,
        reason: analysis.reason,
        changeType: analysis.changeType,
        similarity: analysis.similarity.toFixed(2),
      });

      // Apply optimization decision
      if (analysis.needsChange) {
        result.optimizedFiles[filePath] = proposedDirent || {
          type: 'file',
          content: proposedContent || '',
          isBinary: false,
        };

        switch (analysis.changeType) {
          case 'create':
            result.createdFiles.push(filePath);
            this._log('info', `✅ Creating new file: ${filePath}`);
            break;
          case 'modify':
            result.modifiedFiles.push(filePath);
            this._log(
              'info',
              `✏️ Modifying file: ${filePath} (${analysis.changeMetrics.changePercentage.toFixed(1)}% changed)`,
            );
            break;
          case 'delete':
            result.deletedFiles.push(filePath);
            this._log('warn', `🗑️ Deleting file: ${filePath}`);
            break;
        }

        // Update file hash for future comparisons
        this._updateFileHash(filePath, proposedContent || '');
      } else {
        result.skippedFiles.push(filePath);
        result.totalSaved++;
        this._log('info', `⏩ Skipped unnecessary change to: ${filePath} - ${analysis.reason}`);

        // Log suggestions if any
        if (analysis.suggestions && analysis.suggestions.length > 0) {
          this._log('debug', `Suggestions for ${filePath}:`, analysis.suggestions);
        }
      }

      // Track change history for learning
      this._trackChangeHistory(filePath, analysis);
    }

    // Calculate optimization metrics
    const totalFiles = Object.keys(proposedChanges).length;
    result.optimizationRate = totalFiles > 0 ? (result.skippedFiles.length / totalFiles) * 100 : 0;

    // Generate optimization summary
    this._log('info', '📊 Optimization Summary:');
    this._log('info', `  Total files analyzed: ${totalFiles}`);
    this._log('info', `  Files modified: ${result.modifiedFiles.length}`);
    this._log('info', `  Files created: ${result.createdFiles.length}`);
    this._log('info', `  Files skipped: ${result.skippedFiles.length}`);
    this._log('info', `  Files deleted: ${result.deletedFiles.length}`);
    this._log('info', `  Optimization rate: ${result.optimizationRate.toFixed(1)}%`);
    this._log('info', `  Unnecessary writes prevented: ${result.totalSaved}`);

    // Check for dependency issues
    this._validateDependencies(result.optimizedFiles, existingFiles);

    // Final logs
    result.logs = [...this._logs];

    return result;
  }

  /**
   * Analyzes whether a file change is necessary based on multiple factors
   */
  private async _analyzeFileChange(context: FileContext, userIntent: UserIntent): Promise<FileChangeAnalysis> {
    const { previousContent, newContent, filePath, fileType } = context;

    // New file creation
    if (!previousContent) {
      // Check if file creation is necessary
      if (this._isUnnecessaryFileCreation(filePath, newContent, userIntent)) {
        return {
          needsChange: false,
          reason: 'File creation not required for user request',
          changeType: 'skip',
          similarity: 0,
          hasSignificantChanges: false,
          changeMetrics: this._getEmptyMetrics(),
          suggestions: ['Consider if this file is essential for the requested feature'],
        };
      }

      return {
        needsChange: true,
        reason: 'New file creation',
        changeType: 'create',
        similarity: 0,
        hasSignificantChanges: true,
        changeMetrics: {
          linesAdded: newContent.split('\n').length,
          linesRemoved: 0,
          linesModified: 0,
          totalChanges: newContent.split('\n').length,
          changePercentage: 100,
        },
      };
    }

    // Calculate similarity
    const similarity = this._calculateSimilarity(previousContent, newContent);

    // Calculate detailed change metrics
    const changeMetrics = this._calculateChangeMetrics(previousContent, newContent);

    // Check for whitespace-only changes
    if (this._isWhitespaceOnlyChange(previousContent, newContent)) {
      return {
        needsChange: false,
        reason: 'Only whitespace changes detected',
        changeType: 'skip',
        similarity,
        hasSignificantChanges: false,
        changeMetrics,
        suggestions: ['Whitespace changes are not significant'],
      };
    }

    // Check for comment-only changes
    if (this._isCommentOnlyChange(previousContent, newContent, fileType)) {
      return {
        needsChange: false,
        reason: 'Only comment changes detected',
        changeType: 'skip',
        similarity,
        hasSignificantChanges: false,
        changeMetrics,
        suggestions: ['Comment-only changes may not be necessary'],
      };
    }

    // Check if changes are relevant to user request
    if (!this._isChangeRelevantToRequest(context, userIntent)) {
      return {
        needsChange: false,
        reason: 'Changes not relevant to user request',
        changeType: 'skip',
        similarity,
        hasSignificantChanges: false,
        changeMetrics,
        suggestions: [`Focus on files directly related to: ${userIntent.primaryGoal}`],
      };
    }

    // High similarity check
    if (similarity > this._similarityThreshold) {
      return {
        needsChange: false,
        reason: `File is ${(similarity * 100).toFixed(1)}% similar to existing`,
        changeType: 'skip',
        similarity,
        hasSignificantChanges: false,
        changeMetrics,
        suggestions: ['Changes are too minimal to warrant a file update'],
      };
    }

    // Minimal change check
    if (changeMetrics.changePercentage < this._minimalChangeThreshold * 100) {
      return {
        needsChange: false,
        reason: `Only ${changeMetrics.changePercentage.toFixed(1)}% of file changed`,
        changeType: 'skip',
        similarity,
        hasSignificantChanges: false,
        changeMetrics,
        suggestions: ['Changes are below minimal threshold'],
      };
    }

    // Check for auto-generated files that shouldn't be modified
    if (this._isAutoGeneratedFile(filePath, previousContent)) {
      return {
        needsChange: false,
        reason: 'Auto-generated file should not be modified directly',
        changeType: 'skip',
        similarity,
        hasSignificantChanges: false,
        changeMetrics,
        suggestions: ['Modify source files instead of auto-generated ones'],
      };
    }

    // File needs modification
    return {
      needsChange: true,
      reason: 'Significant changes detected',
      changeType: 'modify',
      similarity,
      hasSignificantChanges: true,
      changeMetrics,
      requiredDependencies: context.dependencies,
      impactedFiles: context.relatedFiles,
    };
  }

  /**
   * Analyzes user intent from the request
   */
  private _analyzeUserIntent(request: string): UserIntent {
    const intent: UserIntent = {
      primaryGoal: '',
      targetFiles: [],
      excludePatterns: [],
      isMinorFix: false,
      isRefactoring: false,
      isFeatureAddition: false,
      isBugFix: false,
      scope: 'unknown',
    };

    const lowerRequest = request.toLowerCase();

    // Detect primary goal
    if (lowerRequest.includes('fix') || lowerRequest.includes('bug') || lowerRequest.includes('error')) {
      intent.isBugFix = true;
      intent.primaryGoal = 'bug fix';
      intent.scope = 'targeted';
    } else if (lowerRequest.includes('add') || lowerRequest.includes('feature') || lowerRequest.includes('implement')) {
      intent.isFeatureAddition = true;
      intent.primaryGoal = 'feature addition';
      intent.scope = 'moderate';
    } else if (
      lowerRequest.includes('refactor') ||
      lowerRequest.includes('clean') ||
      lowerRequest.includes('optimize')
    ) {
      intent.isRefactoring = true;
      intent.primaryGoal = 'refactoring';
      intent.scope = 'broad';
    } else if (lowerRequest.includes('typo') || lowerRequest.includes('minor') || lowerRequest.includes('small')) {
      intent.isMinorFix = true;
      intent.primaryGoal = 'minor fix';
      intent.scope = 'minimal';
    }

    // Extract file patterns mentioned
    const filePatterns = request.match(/[\w\-\/]+\.\w+/g);

    if (filePatterns) {
      intent.targetFiles = filePatterns;
    }

    // Detect exclusion patterns
    if (lowerRequest.includes('only') || lowerRequest.includes('just')) {
      intent.scope = 'minimal';
    }

    return intent;
  }

  /**
   * Calculates similarity between two file contents
   */
  private _calculateSimilarity(content1: string, content2: string): number {
    if (content1 === content2) {
      return 1.0;
    }

    if (!content1 || !content2) {
      return 0.0;
    }

    // Use Levenshtein distance for similarity calculation
    const maxLength = Math.max(content1.length, content2.length);

    if (maxLength === 0) {
      return 1.0;
    }

    const distance = this._levenshteinDistance(content1, content2);

    return 1 - distance / maxLength;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private _levenshteinDistance(str1: string, str2: string): number {
    const m = str1.length;
    const n = str2.length;
    const dp: number[][] = Array(m + 1)
      .fill(null)
      .map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) {
      dp[i][0] = i;
    }

    for (let j = 0; j <= n; j++) {
      dp[0][j] = j;
    }

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = Math.min(
            dp[i - 1][j] + 1, // deletion
            dp[i][j - 1] + 1, // insertion
            dp[i - 1][j - 1] + 1, // substitution
          );
        }
      }
    }

    return dp[m][n];
  }

  /**
   * Calculate detailed change metrics
   */
  private _calculateChangeMetrics(oldContent: string, newContent: string): FileChangeAnalysis['changeMetrics'] {
    const diff = diffLines(oldContent, newContent);

    let linesAdded = 0;
    let linesRemoved = 0;
    let linesModified = 0;

    diff.forEach((part) => {
      const lines = part.value.split('\n').length - 1;

      if (part.added) {
        linesAdded += lines;
      } else if (part.removed) {
        linesRemoved += lines;
      }
    });

    // Estimate modified lines (minimum of added and removed)
    linesModified = Math.min(linesAdded, linesRemoved);

    const totalLines = Math.max(oldContent.split('\n').length, newContent.split('\n').length);

    const totalChanges = linesAdded + linesRemoved;
    const changePercentage = totalLines > 0 ? (totalChanges / totalLines) * 100 : 0;

    return {
      linesAdded,
      linesRemoved,
      linesModified,
      totalChanges,
      changePercentage,
    };
  }

  /**
   * Check if changes are only whitespace
   */
  private _isWhitespaceOnlyChange(oldContent: string, newContent: string): boolean {
    const normalizeWhitespace = (str: string) => str.replace(/\s+/g, ' ').trim();
    return normalizeWhitespace(oldContent) === normalizeWhitespace(newContent);
  }

  /**
   * Check if changes are only in comments
   */
  private _isCommentOnlyChange(oldContent: string, newContent: string, fileType: string): boolean {
    const removeComments = (str: string): string => {
      switch (fileType) {
        case 'js':
        case 'ts':
        case 'jsx':
        case 'tsx':
          return str.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '');
        case 'css':
        case 'scss':
          return str.replace(/\/\*[\s\S]*?\*\//g, '');
        case 'html':
        case 'xml':
          return str.replace(/<!--[\s\S]*?-->/g, '');
        case 'py':
        case 'sh':
          return str.replace(/#.*/g, '');
        default:
          return str;
      }
    };

    return removeComments(oldContent).trim() === removeComments(newContent).trim();
  }

  /**
   * Check if file creation is unnecessary
   */
  private _isUnnecessaryFileCreation(filePath: string, content: string, userIntent: UserIntent): boolean {
    // Don't create test files unless explicitly requested
    if (filePath.includes('.test.') || filePath.includes('.spec.')) {
      return !userIntent.primaryGoal.includes('test');
    }

    // Don't create documentation unless requested
    if (filePath.endsWith('.md') || filePath.endsWith('.txt')) {
      return !userIntent.primaryGoal.includes('doc') && !userIntent.primaryGoal.includes('readme');
    }

    // Don't create config files unless necessary
    if (this._isConfigFile(filePath)) {
      return userIntent.scope === 'minimal' || userIntent.isMinorFix;
    }

    // Don't create empty or near-empty files
    if (content.trim().length < 50) {
      return true;
    }

    return false;
  }

  /**
   * Check if changes are relevant to user request
   */
  private _isChangeRelevantToRequest(context: FileContext, userIntent: UserIntent): boolean {
    const { filePath, newContent, previousContent } = context;

    // If specific files are targeted, only modify those
    if (userIntent.targetFiles.length > 0) {
      return userIntent.targetFiles.some((target) => filePath.includes(target) || target.includes(filePath));
    }

    // For bug fixes, focus on files with actual logic changes
    if (userIntent.isBugFix) {
      const diff = createPatch(filePath, previousContent || '', newContent);
      return diff.includes('function') || diff.includes('class') || diff.includes('if') || diff.includes('return');
    }

    // For minor fixes, only allow minimal changes
    if (userIntent.isMinorFix) {
      const metrics = this._calculateChangeMetrics(previousContent || '', newContent);
      return metrics.totalChanges < 10;
    }

    return true;
  }

  /**
   * Check if file is auto-generated
   */
  private _isAutoGeneratedFile(filePath: string, content: string): boolean {
    // Check common auto-generated file patterns
    const autoGenPatterns = [
      'package-lock.json',
      'yarn.lock',
      'pnpm-lock.yaml',
      '.next/',
      'dist/',
      'build/',
      'node_modules/',
      '.git/',
      'coverage/',
    ];

    if (autoGenPatterns.some((pattern) => filePath.includes(pattern))) {
      return true;
    }

    // Check for auto-generation markers in content
    const autoGenMarkers = ['auto-generated', 'do not edit', 'generated file', 'this file is generated'];

    const contentLower = content.toLowerCase();

    return autoGenMarkers.some((marker) => contentLower.includes(marker));
  }

  /**
   * Extract dependencies from file content
   */
  private _extractDependencies(content: string, filePath: string): string[] {
    const deps: string[] = [];
    const fileType = this._getFileType(filePath);

    if (['js', 'ts', 'jsx', 'tsx'].includes(fileType)) {
      // Extract imports
      const importRegex = /import\s+(?:.*?\s+from\s+)?['"]([^'"]+)['"]/g;
      let match;

      while ((match = importRegex.exec(content)) !== null) {
        deps.push(match[1]);
      }

      // Extract requires
      const requireRegex = /require\s*\(['"]([^'"]+)['"]\)/g;

      while ((match = requireRegex.exec(content)) !== null) {
        deps.push(match[1]);
      }
    }

    return [...new Set(deps)];
  }

  /**
   * Find files related to the current file
   */
  private _findRelatedFiles(filePath: string, existingFiles: FileMap): string[] {
    const related: string[] = [];
    const fileName = filePath.split('/').pop()?.split('.')[0];

    if (!fileName) {
      return related;
    }

    // Find test files
    const testPatterns = [`${fileName}.test`, `${fileName}.spec`, `__tests__/${fileName}`];

    // Find related components/modules
    Object.keys(existingFiles).forEach((file) => {
      if (file === filePath) {
        return;
      }

      // Check if it's a related test file
      if (testPatterns.some((pattern) => file.includes(pattern))) {
        related.push(file);
      }

      // Check if it imports this file
      const dirent = existingFiles[file];
      const content = dirent?.type === 'file' ? dirent.content : '';

      if (content && (content.includes(filePath) || content.includes(fileName))) {
        related.push(file);
      }
    });

    return related;
  }

  /**
   * Validate dependencies after optimization
   */
  private _validateDependencies(optimizedFiles: FileMap, existingFiles: FileMap): void {
    const allFiles = { ...existingFiles, ...optimizedFiles };

    Object.entries(optimizedFiles).forEach(([filePath, dirent]) => {
      const content = dirent?.type === 'file' ? dirent.content : '';
      const deps = this._extractDependencies(content, filePath);

      deps.forEach((dep) => {
        // Check if dependency exists
        if (dep.startsWith('.')) {
          const resolvedPath = this._resolvePath(filePath, dep);

          if (!allFiles[resolvedPath] && !this._fileExists(resolvedPath)) {
            this._log('warn', `Missing dependency: ${dep} in ${filePath}`);
          }
        }
      });
    });
  }

  /**
   * Track change history for learning
   */
  private _trackChangeHistory(filePath: string, analysis: FileChangeAnalysis): void {
    if (!this._changeHistory.has(filePath)) {
      this._changeHistory.set(filePath, []);
    }

    const history = this._changeHistory.get(filePath)!;
    history.push(analysis);

    // Keep only last 10 changes
    if (history.length > 10) {
      history.shift();
    }
  }

  /**
   * Update file hash for tracking
   */
  private _updateFileHash(filePath: string, content: string): void {
    // Use a simple hash function for browser compatibility
    const hash = this._simpleHash(content);
    this._fileHashes.set(filePath, hash);
  }

  /**
   * Simple hash function for browser compatibility
   */
  private _simpleHash(str: string): string {
    let hash = 0;

    if (str.length === 0) {
      return hash.toString();
    }

    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }

    return Math.abs(hash).toString(36);
  }

  /**
   * Get file type from path
   */
  private _getFileType(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    return ext;
  }

  /**
   * Check if file is a config file
   */
  private _isConfigFile(filePath: string): boolean {
    const configPatterns = [
      '.config.',
      'config/',
      'tsconfig',
      'package.json',
      '.eslintrc',
      '.prettierrc',
      'webpack',
      'vite',
      'rollup',
      '.env',
    ];

    return configPatterns.some((pattern) => filePath.includes(pattern));
  }

  /**
   * Resolve relative path
   */
  private _resolvePath(fromFile: string, relativePath: string): string {
    const fromDir = fromFile.split('/').slice(0, -1).join('/');
    const parts = relativePath.split('/');
    const resolvedParts = fromDir.split('/');

    parts.forEach((part) => {
      if (part === '..') {
        resolvedParts.pop();
      } else if (part !== '.') {
        resolvedParts.push(part);
      }
    });

    return resolvedParts.join('/');
  }

  /**
   * Check if file exists (mock implementation)
   */
  private _fileExists(path: string): boolean {
    /*
     * This would need actual file system check
     * For now, check common file extensions
     */
    const commonExtensions = ['.js', '.ts', '.jsx', '.tsx', '.json', '.css', '.scss'];
    return commonExtensions.some((ext) => path.endsWith(ext));
  }

  /**
   * Get empty metrics
   */
  private _getEmptyMetrics(): FileChangeAnalysis['changeMetrics'] {
    return {
      linesAdded: 0,
      linesRemoved: 0,
      linesModified: 0,
      totalChanges: 0,
      changePercentage: 0,
    };
  }

  /**
   * Logging utility
   */
  private _log(level: OptimizationLog['level'], message: string, details?: any): void {
    const log: OptimizationLog = {
      timestamp: Date.now(),
      level,
      message,
      details,
    };

    this._logs.push(log);

    // Console output with colors
    const prefix = `[FileChangeOptimizer]`;
    const timestamp = new Date().toISOString();

    switch (level) {
      case 'error':
        logger.error(`${prefix} ${timestamp} - ${message}`, details);
        break;
      case 'warn':
        logger.warn(`${prefix} ${timestamp} - ${message}`, details);
        break;
      case 'info':
        logger.info(`${prefix} ${timestamp} - ${message}`, details);
        break;
      case 'debug':
        logger.debug(`${prefix} ${timestamp} - ${message}`, details);
        break;
    }
  }

  /**
   * Get optimization logs
   */
  getLogs(): OptimizationLog[] {
    return [...this._logs];
  }

  /**
   * Clear logs
   */
  clearLogs(): void {
    this._logs = [];
  }
}

interface UserIntent {
  primaryGoal: string;
  targetFiles: string[];
  excludePatterns: string[];
  isMinorFix: boolean;
  isRefactoring: boolean;
  isFeatureAddition: boolean;
  isBugFix: boolean;
  scope: 'minimal' | 'targeted' | 'moderate' | 'broad' | 'unknown';
}

// Export singleton instance
export const fileChangeOptimizer = new FileChangeOptimizer();
