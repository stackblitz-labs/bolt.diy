export interface ProjectCallContext {
  generation: number;
  chatId?: string;
}

/**
 * A new chat starts before it has a persisted ID. Its first history save assigns
 * that ID and advances the project generation while the first response may
 * still be waiting for a project-tool approval. Treat only that one transition
 * as the same project; every other generation or chat change invalidates it.
 */
export function resolveProjectCallContext(
  origin: ProjectCallContext | undefined,
  active: ProjectCallContext,
  chatChanged: boolean,
): ProjectCallContext | undefined {
  if (!origin) {
    return undefined;
  }

  if (origin.generation === active.generation && origin.chatId === active.chatId) {
    return origin;
  }

  if (
    origin.chatId === undefined &&
    active.chatId !== undefined &&
    !chatChanged &&
    active.generation === origin.generation + 1
  ) {
    return active;
  }

  return undefined;
}
