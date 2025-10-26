#!/usr/bin/env bash

# Ensure we're running in bash
if [ -z "$BASH_VERSION" ]; then
    echo "This script requires bash. Please run with: bash $0" >&2
    exit 1
fi

# Ensure we're using bash 4.0 or later for associative arrays
if ((BASH_VERSINFO[0] < 4)); then
    echo "This script requires bash version 4 or later" >&2
    echo "Current bash version: $BASH_VERSION" >&2
    exit 1
fi

# Set default values for required environment variables if not in GitHub Actions
if [ -z "$GITHUB_ACTIONS" ]; then
    : "${GITHUB_SERVER_URL:=https://github.com}"
    : "${GITHUB_REPOSITORY:=stackblitz-labs/bolt.diy}"
    : "${GITHUB_OUTPUT:=/tmp/github_output}"
    touch "$GITHUB_OUTPUT"

    # Running locally
    echo "Running locally - checking for upstream remote..."
    MAIN_REMOTE="origin"
    if git remote -v | grep -q "upstream"; then
        MAIN_REMOTE="upstream"
    fi
    MAIN_BRANCH="main"  # or "master" depending on your repository
    
    # Ensure we have latest tags
    git fetch ${MAIN_REMOTE} --tags
    
    # Use the remote reference for git log
    GITLOG_REF="${MAIN_REMOTE}/${MAIN_BRANCH}"
else
    # Running in GitHub Actions
    GITLOG_REF="HEAD"
fi

# Get the latest tag
LATEST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")

# Start changelog file
echo "# 🚀 Release v${NEW_VERSION}" > changelog.md
echo "" >> changelog.md
echo "## What's Changed 🌟" >> changelog.md
echo "" >> changelog.md

if [ -z "$LATEST_TAG" ]; then
    echo "### 🎉 First Release" >> changelog.md
    echo "" >> changelog.md
    echo "Exciting times! This marks our first release. Thanks to everyone who contributed! 🙌" >> changelog.md
    echo "" >> changelog.md
    COMPARE_BASE="$(git rev-list --max-parents=0 HEAD)"
else
    echo "### 🔄 Changes since $LATEST_TAG" >> changelog.md
    echo "" >> changelog.md
    COMPARE_BASE="$LATEST_TAG"
fi

# Function to extract conventional commit type and associated emoji
get_commit_type() {
    local msg="$1"
    if [[ $msg =~ ^feat(\(.+\))?:|^feature(\(.+\))?: ]]; then echo "✨ Features"
    elif [[ $msg =~ ^fix(\(.+\))?: ]]; then echo "🐛 Bug Fixes"
    elif [[ $msg =~ ^docs(\(.+\))?: ]]; then echo "📚 Documentation"
    elif [[ $msg =~ ^style(\(.+\))?: ]]; then echo "💎 Styles"
    elif [[ $msg =~ ^refactor(\(.+\))?: ]]; then echo "♻️ Code Refactoring"
    elif [[ $msg =~ ^perf(\(.+\))?: ]]; then echo "⚡ Performance Improvements"
    elif [[ $msg =~ ^test(\(.+\))?: ]]; then echo "🧪 Tests"
    elif [[ $msg =~ ^build(\(.+\))?: ]]; then echo "🛠️ Build System"
    elif [[ $msg =~ ^ci(\(.+\))?: ]]; then echo "⚙️ CI"
    elif [[ $msg =~ ^chore(\(.+\))?: ]]; then echo ""  # Skip chore commits
    else echo "🔍 Other Changes"  # Default category with emoji
    fi
}

# Initialize associative arrays
declare -A CATEGORIES
declare -A COMMITS_BY_CATEGORY
declare -A ALL_AUTHORS
declare -A NEW_CONTRIBUTORS

# Get all historical authors before the compare base
while IFS= read -r author; do
    ALL_AUTHORS["$author"]=1
done < <(git log "${COMPARE_BASE}" --pretty=format:"%ae" | sort -u)

# Process all commits since last tag
while IFS= read -r commit_line; do
    if [[ ! $commit_line =~ ^[a-f0-9]+\| ]]; then
        echo "WARNING: Skipping invalid commit line format: $commit_line" >&2
        continue
    fi
    
    HASH=$(echo "$commit_line" | cut -d'|' -f1)
    COMMIT_MSG=$(echo "$commit_line" | cut -d'|' -f2)
    BODY=$(echo "$commit_line" | cut -d'|' -f3)
    # Skip if hash doesn't match the expected format
    if [[ ! $HASH =~ ^[a-f0-9]{40}$ ]]; then
        continue
    fi

    HASH=$(echo "$commit_line" | cut -d'|' -f1)
    COMMIT_MSG=$(echo "$commit_line" | cut -d'|' -f2)
    BODY=$(echo "$commit_line" | cut -d'|' -f3)

    
    # Validate hash format
    if [[ ! $HASH =~ ^[a-f0-9]{40}$ ]]; then
        echo "WARNING: Invalid commit hash format: $HASH" >&2
        continue
    fi
    
    # Check if it's a merge commit
    if [[ $COMMIT_MSG =~ Merge\ pull\ request\ #([0-9]+) ]]; then
        # echo "Processing as merge commit" >&2
        PR_NUM="${BASH_REMATCH[1]}"
        
        # Extract the PR title from the merge commit body
        PR_TITLE=$(echo "$BODY" | grep -v "^Merge pull request" | head -n 1)
        
        # Only process if it follows conventional commit format
        CATEGORY=$(get_commit_type "$PR_TITLE")
        
        if [ -n "$CATEGORY" ]; then  # Only process if it's a conventional commit
            # Get PR author's GitHub username
            GITHUB_USERNAME=$(gh pr view "$PR_NUM" --json author --jq '.author.login')
            
            if [ -n "$GITHUB_USERNAME" ]; then
                # Check if this is a first-time contributor
                AUTHOR_EMAIL=$(git show -s --format='%ae' "$HASH")
                if [ -z "${ALL_AUTHORS[$AUTHOR_EMAIL]}" ]; then
                    NEW_CONTRIBUTORS["$GITHUB_USERNAME"]=1
                    ALL_AUTHORS["$AUTHOR_EMAIL"]=1
                fi

                CATEGORIES["$CATEGORY"]=1
                COMMITS_BY_CATEGORY["$CATEGORY"]+="* ${PR_TITLE#*: } ([#$PR_NUM](${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/pull/$PR_NUM)) by @$GITHUB_USERNAME"$'\n'
            else
                COMMITS_BY_CATEGORY["$CATEGORY"]+="* ${PR_TITLE#*: } ([#$PR_NUM](${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/pull/$PR_NUM))"$'\n'
            fi
        fi
    # Check if it's a squash merge by looking for (#NUMBER) pattern
    elif [[ $COMMIT_MSG =~ \(#([0-9]+)\) ]]; then
        # echo "Processing as squash commit" >&2
        PR_NUM="${BASH_REMATCH[1]}"
        
        # Only process if it follows conventional commit format
        CATEGORY=$(get_commit_type "$COMMIT_MSG")
        
        if [ -n "$CATEGORY" ]; then  # Only process if it's a conventional commit
            # Get PR author's GitHub username
            GITHUB_USERNAME=$(gh pr view "$PR_NUM" --json author --jq '.author.login')
            
            if [ -n "$GITHUB_USERNAME" ]; then
                # Check if this is a first-time contributor
                AUTHOR_EMAIL=$(git show -s --format='%ae' "$HASH")
                if [ -z "${ALL_AUTHORS[$AUTHOR_EMAIL]}" ]; then
                    NEW_CONTRIBUTORS["$GITHUB_USERNAME"]=1
                    ALL_AUTHORS["$AUTHOR_EMAIL"]=1
                fi

                CATEGORIES["$CATEGORY"]=1
                COMMIT_TITLE=${COMMIT_MSG%% (#*}  # Remove the PR number suffix
                COMMIT_TITLE=${COMMIT_TITLE#*: }  # Remove the type prefix
                COMMITS_BY_CATEGORY["$CATEGORY"]+="* $COMMIT_TITLE ([#$PR_NUM](${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/pull/$PR_NUM)) by @$GITHUB_USERNAME"$'\n'
            else
                COMMIT_TITLE=${COMMIT_MSG%% (#*}  # Remove the PR number suffix
                COMMIT_TITLE=${COMMIT_TITLE#*: }  # Remove the type prefix
                COMMITS_BY_CATEGORY["$CATEGORY"]+="* $COMMIT_TITLE ([#$PR_NUM](${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/pull/$PR_NUM))"$'\n'
            fi
        fi
    
    else 
        # echo "Processing as regular commit" >&2
        # Process conventional commits without PR numbers
        CATEGORY=$(get_commit_type "$COMMIT_MSG")
        
        if [ -n "$CATEGORY" ]; then  # Only process if it's a conventional commit
            # Get commit author info
            AUTHOR_EMAIL=$(git show -s --format='%ae' "$HASH")
            
            # Try to get GitHub username using gh api
            if [ -n "$GITHUB_ACTIONS" ] || command -v gh >/dev/null 2>&1; then
                GITHUB_USERNAME=$(gh api "/repos/${GITHUB_REPOSITORY}/commits/${HASH}" --jq '.author.login' 2>/dev/null)
            fi
            
            if [ -n "$GITHUB_USERNAME" ]; then
                # If we got GitHub username, use it
                if [ -z "${ALL_AUTHORS[$AUTHOR_EMAIL]}" ]; then
                    NEW_CONTRIBUTORS["$GITHUB_USERNAME"]=1
                    ALL_AUTHORS["$AUTHOR_EMAIL"]=1
                fi

                CATEGORIES["$CATEGORY"]=1
                COMMIT_TITLE=${COMMIT_MSG#*: }  # Remove the type prefix
                COMMITS_BY_CATEGORY["$CATEGORY"]+="* $COMMIT_TITLE (${HASH:0:7}) by @$GITHUB_USERNAME"$'\n'
            else
                # Fallback to git author name if no GitHub username found
                AUTHOR_NAME=$(git show -s --format='%an' "$HASH")
                
                if [ -z "${ALL_AUTHORS[$AUTHOR_EMAIL]}" ]; then
                    NEW_CONTRIBUTORS["$AUTHOR_NAME"]=1
                    ALL_AUTHORS["$AUTHOR_EMAIL"]=1
                fi

                CATEGORIES["$CATEGORY"]=1
                COMMIT_TITLE=${COMMIT_MSG#*: }  # Remove the type prefix
                COMMITS_BY_CATEGORY["$CATEGORY"]+="* $COMMIT_TITLE (${HASH:0:7}) by $AUTHOR_NAME"$'\n'
            fi
        fi
    fi
    
done < <(git log "${COMPARE_BASE}..${GITLOG_REF}" --pretty=format:"%H|%s|%b" --reverse --first-parent)

# Write categorized commits to changelog with their emojis
for category in "✨ Features" "🐛 Bug Fixes" "📚 Documentation" "💎 Styles" "♻️ Code Refactoring" "⚡ Performance Improvements" "🧪 Tests" "🛠️ Build System" "⚙️ CI" "🔍 Other Changes"; do
    if [ -n "${COMMITS_BY_CATEGORY[$category]}" ]; then
        echo "### $category" >> changelog.md
        echo "" >> changelog.md
        echo "${COMMITS_BY_CATEGORY[$category]}" >> changelog.md
        echo "" >> changelog.md
    fi
done

# Add first-time contributors section if there are any
if [ ${#NEW_CONTRIBUTORS[@]} -gt 0 ]; then
    echo "## ✨ First-time Contributors" >> changelog.md
    echo "" >> changelog.md
    echo "A huge thank you to our amazing new contributors! Your first contribution marks the start of an exciting journey! 🌟" >> changelog.md
    echo "" >> changelog.md
    # Use readarray to sort the keys
    readarray -t sorted_contributors < <(printf '%s\n' "${!NEW_CONTRIBUTORS[@]}" | sort)
    for github_username in "${sorted_contributors[@]}"; do
        echo "* 🌟 [@$github_username](https://github.com/$github_username)" >> changelog.md
    done
    echo "" >> changelog.md
fi

# Add compare link if not first release
if [ -n "$LATEST_TAG" ]; then
    echo "## 📈 Stats" >> changelog.md
    echo "" >> changelog.md
    echo "**Full Changelog**: [\`$LATEST_TAG..v${NEW_VERSION}\`](${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/compare/$LATEST_TAG...v${NEW_VERSION})" >> changelog.md
fi

# Output the changelog content
CHANGELOG_CONTENT=$(cat changelog.md)
{
    echo "content<<EOF"
    echo "$CHANGELOG_CONTENT"
    echo "EOF"
} >> "$GITHUB_OUTPUT"

# Also print to stdout for local testing
echo "Generated changelog:"
echo "==================="
cat changelog.md
echo "==================="