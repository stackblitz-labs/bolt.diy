import React from 'react';

interface BaseRepository {
  name: string;
  description?: string;
  default_branch: string;
  updated_at: string;
}

interface GitHubRepository extends BaseRepository {
  html_url: string;
  stargazers_count: number;
  forks_count: number;
  private?: boolean;
  fork?: boolean;
  archived?: boolean;
  topics?: string[];
  language?: string;
  size?: number;
}

interface GitLabRepository extends BaseRepository {
  http_url_to_repo: string;
  star_count: number;
  forks_count: number;
  visibility?: string;
}

type Repository = GitHubRepository | GitLabRepository;

interface RepositoryCardProps<T extends Repository = Repository> {
  repo: T;
  onClone?: (repo: T) => void;
  variant?: 'github' | 'gitlab';
}

function isGitHubRepo(repo: Repository): repo is GitHubRepository {
  return 'html_url' in repo;
}

export function RepositoryCard<T extends Repository = Repository>({ repo, onClone }: RepositoryCardProps<T>) {
  const isGitHub = isGitHubRepo(repo);
  const url = isGitHub ? repo.html_url : (repo as GitLabRepository).http_url_to_repo;
  const stars = isGitHub ? repo.stargazers_count : (repo as GitLabRepository).star_count;
  const forks = isGitHub ? repo.forks_count : (repo as GitLabRepository).forks_count;

  return (
    <a
      key={repo.name}
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block p-4 rounded-lg bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor hover:border-bolt-elements-borderColorActive transition-all duration-200"
    >
      <div className="flex flex-col h-full">
        <div className="flex-1 space-y-3">
          {/* Header with name and stats */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="i-ph:git-branch w-4 h-4 text-bolt-elements-icon-info" />
              <h5 className="text-sm font-medium text-bolt-elements-textPrimary group-hover:text-bolt-elements-item-contentAccent transition-colors">
                {repo.name}
              </h5>

              {/* GitHub-specific badges */}
              {isGitHub && (
                <>
                  {repo.private && (
                    <div className="i-ph:lock w-3 h-3 text-bolt-elements-textTertiary" title="Private repository" />
                  )}
                  {repo.fork && (
                    <div className="i-ph:git-fork w-3 h-3 text-bolt-elements-textTertiary" title="Forked repository" />
                  )}
                  {repo.archived && (
                    <div className="i-ph:archive w-3 h-3 text-bolt-elements-textTertiary" title="Archived repository" />
                  )}
                </>
              )}

              {/* GitLab visibility badge */}
              {!isGitHub && (repo as GitLabRepository).visibility && (
                <span className="text-xs text-bolt-elements-textTertiary px-1.5 py-0.5 rounded bg-bolt-elements-background-depth-2">
                  {(repo as GitLabRepository).visibility}
                </span>
              )}
            </div>

            {/* Stars and forks */}
            <div className="flex items-center gap-3 text-xs text-bolt-elements-textSecondary">
              <span className="flex items-center gap-1" title="Stars">
                <div className="i-ph:star w-3.5 h-3.5 text-bolt-elements-icon-warning" />
                {stars.toLocaleString()}
              </span>
              <span className="flex items-center gap-1" title="Forks">
                <div className="i-ph:git-fork w-3.5 h-3.5 text-bolt-elements-icon-info" />
                {forks.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Description */}
          {repo.description && (
            <p className="text-xs text-bolt-elements-textSecondary line-clamp-2">{repo.description}</p>
          )}

          {/* Metadata row */}
          <div className="flex items-center gap-3 text-xs text-bolt-elements-textSecondary">
            <span className="flex items-center gap-1" title="Default Branch">
              <div className="i-ph:git-branch w-3.5 h-3.5" />
              {repo.default_branch}
            </span>

            {/* GitHub language */}
            {isGitHub && repo.language && (
              <span className="flex items-center gap-1" title="Primary Language">
                <div className="w-2 h-2 rounded-full bg-current opacity-60" />
                {repo.language}
              </span>
            )}

            <span className="flex items-center gap-1" title="Last Updated">
              <div className="i-ph:clock w-3.5 h-3.5" />
              {new Date(repo.updated_at).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </span>
          </div>

          {/* GitHub topics */}
          {isGitHub && repo.topics && repo.topics.length > 0 && (
            <div className="flex items-center gap-2 text-xs flex-wrap">
              {repo.topics.slice(0, 3).map((topic) => (
                <span
                  key={topic}
                  className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400"
                  title={`Topic: ${topic}`}
                >
                  {topic}
                </span>
              ))}
              {repo.topics.length > 3 && (
                <span className="text-bolt-elements-textTertiary">+{repo.topics.length - 3} more</span>
              )}
            </div>
          )}

          {/* GitHub repository size */}
          {isGitHub && repo.size && (
            <div className="text-xs text-bolt-elements-textTertiary">Size: {(repo.size / 1024).toFixed(1)} MB</div>
          )}
        </div>

        {/* Bottom section with actions */}
        <div className="flex items-center justify-between pt-3 mt-auto">
          <span className="flex items-center gap-1 text-xs text-bolt-elements-textSecondary group-hover:text-bolt-elements-item-contentAccent transition-colors">
            <div className="i-ph:arrow-square-out w-3.5 h-3.5" />
            View
          </span>
          {onClone && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClone(repo);
              }}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-bolt-elements-background-depth-2 hover:bg-bolt-elements-background-depth-3 text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-colors"
              title="Clone repository"
            >
              <div className="i-ph:git-branch w-3.5 h-3.5" />
              Clone
            </button>
          )}
        </div>
      </div>
    </a>
  );
}
