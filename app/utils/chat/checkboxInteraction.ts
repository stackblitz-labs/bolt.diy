import type { Message } from '~/lib/persistence/message';

/**
 * Extracts checkbox options from a markdown message content.
 * Looks for markdown checkbox list items like "- [ ] Option text"
 */
function extractCheckboxOptions(messageContent: string): string[] {
  const options: string[] = [];

  // Match markdown checkbox list items: "- [ ]" or "- [x]" followed by text
  const checkboxPattern = /^[-*]\s+\[[\sx]\]\s+(.+)$/gm;
  let match;

  while ((match = checkboxPattern.exec(messageContent)) !== null) {
    const optionText = match[1].trim();
    if (optionText) {
      options.push(optionText);
    }
  }

  return options;
}

/**
 * Checks if a submitted message content contains any of the checkbox options.
 * The submitted content may contain newlines between selected options.
 */
function matchesCheckboxOptions(submittedContent: string, options: string[]): string[] {
  const matchedOptions: string[] = [];
  const normalizedSubmitted = submittedContent.trim();

  for (const option of options) {
    // Check if the submitted content contains this option text
    if (normalizedSubmitted.includes(option)) {
      matchedOptions.push(option);
    }
  }

  return matchedOptions;
}

/**
 * Determines which checkbox options were selected by checking subsequent messages.
 *
 * @param checkboxMessage - The message containing checkboxes
 * @param allMessages - All messages in the chat, sorted by createTime
 * @returns Array of option texts that were selected
 */
export function getCheckedOptions(checkboxMessage: Message, allMessages: Message[]): string[] {
  // Extract checkbox options from the message content
  const options = extractCheckboxOptions(checkboxMessage.content);

  if (options.length === 0 || !checkboxMessage.createTime) {
    return [];
  }

  const checkboxTime = new Date(checkboxMessage.createTime).getTime();

  // Get all user messages that come after the checkbox message chronologically
  const subsequentMessages = allMessages
    .filter((m) => {
      if (m.role !== 'user') {
        return false;
      }
      if (!m.createTime) {
        return false;
      }
      const messageTime = new Date(m.createTime).getTime();
      return messageTime > checkboxTime;
    })
    .sort((a, b) => {
      const aTime = new Date(a.createTime!).getTime();
      const bTime = new Date(b.createTime!).getTime();
      return aTime - bTime;
    });

  // Check each subsequent user message for matching checkbox content
  const checkedOptionsSet = new Set<string>();

  for (const message of subsequentMessages) {
    const matched = matchesCheckboxOptions(message.content, options);
    matched.forEach((option) => checkedOptionsSet.add(option));
  }

  return Array.from(checkedOptionsSet);
}
