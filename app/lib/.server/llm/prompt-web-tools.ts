/** Describe the research tools available on this request, after connector and action filtering. */
export function getWebResearchInstructions({
  browserUseToolNames,
  webToolNames,
}: {
  browserUseToolNames: string[];
  webToolNames: string[];
}): string {
  const instructions = [
    '<web_research_tools>',
    'Use the enabled research tools whenever the user requests a search, current information, or page research, and whenever web evidence would help you answer or build accurately. Research can happen at any stage in Build or Discuss mode. Use the results to inform your subsequent work and cite useful source URLs. Only claim to have searched or visited a page after a tool result confirms it.',
  ];

  if (browserUseToolNames.length > 0) {
    instructions.push(
      `Browser Use Cloud is enabled. Its available tools are: ${browserUseToolNames.join(', ')}. Use these tools for public web searches, visiting URLs, and interacting with pages. Follow their descriptions to create or reuse a browser session, perform the task, and retrieve its results. If the user asks for Browser Use, select these tools.`,
      'Browser tasks may run asynchronously. Use the returned session ID with the available status and result tools until the task finishes, then use its output. Reuse the same session when checking progress; do not launch duplicate tasks to poll. A running task is not a completed search.',
      'If a tool reports insufficient balance, invalid credentials, or an account limit, stop retrying and explain the error. Public research does not require a stored authentication profile. You may use a relevant completed session, but clearly say that its results came from an earlier search.',
    );
  }

  if (webToolNames.length > 0) {
    instructions.push(`Built-in Web Search is enabled. Its available tools are: ${webToolNames.join(', ')}.`);
  } else {
    instructions.push('Built-in Web Search is disabled or unavailable. Do not call its tools.');

    if (browserUseToolNames.length > 0) {
      instructions.push(
        'Use Browser Use Cloud for web research, including ordinary searches and reading pages; no special wording from the user is needed.',
      );
    }
  }

  if (browserUseToolNames.length === 0 && webToolNames.length === 0) {
    instructions.push(
      'No web research tools are available. Explain this limitation if the request needs live web information.',
    );
  }

  instructions.push(
    'For an information lookup, answer with the findings. Create or change project files when the user requests a build or code change.',
  );
  instructions.push('</web_research_tools>');

  return instructions.join('\n');
}
