// Client messages match the format used by the Nut protocol.

type MessageRole = 'user' | 'assistant';

export interface ChatMessageAttachment {
  attachmentId: string;
  fileName: string;
  byteLength: number;
  mimeType: string;
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  attachments?: ChatMessageAttachment[];
  repositoryId?: string;
  peanuts?: number;
  category?: string;
  createTime?: string;

  // Not part of the protocol, indicates whether the user has explicitly approved
  // the message. Once approved, the approve/reject UI is not shown again for the message.
  approved?: boolean;

  hasInteracted: boolean;
}

// Category for the initial response made to every user message.
// All messages up to the next UserResponse are responding to this message.
export const USER_RESPONSE_CATEGORY = 'UserResponse';

// Category used when sending a chat message in discovery mode.
export const DISCOVERY_RESPONSE_CATEGORY = 'DiscoveryResponse';

// Category used to update the discovery rating after each response.
export const DISCOVERY_RATING_CATEGORY = 'DiscoveryRating';

// JSON stringified contents of a discovery rating message.
interface DiscoveryRating {
  rating: number;
}

// Discovery ratings are on a scale from 0 to 10.
export const MAX_DISCOVERY_RATING = 10;

export function getDiscoveryRating(messages: Message[]): number {
  const discoveryRatingMessage = messages.findLast((message) => message.category === DISCOVERY_RATING_CATEGORY);
  if (!discoveryRatingMessage) {
    return 0;
  }
  const info: DiscoveryRating = JSON.parse(discoveryRatingMessage.content);
  return info.rating;
}
