// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import McpTab from './McpTab';
import { useMCPStore } from '~/lib/stores/mcp';

// Remix's development transform expects the browser preamble, which Vitest does not load.
vi.hoisted(() => {
  Object.assign(window, { __vite_plugin_react_preamble_installed__: true });
});

const existingSettings = {
  maxLLMSteps: 3,
  mcpConfig: { mcpServers: { existing: { type: 'streamable-http' as const, url: 'https://example.com/mcp' } } },
};

beforeEach(() => {
  localStorage.clear();
  useMCPStore.setState({ ...useMCPStore.getInitialState() });
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async () => Response.json({})),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('MCP example configuration', () => {
  it('keeps a fresh installation empty until the user saves', async () => {
    render(<McpTab />);
    await waitFor(() => expect(useMCPStore.getState().isInitialized).toBe(true));
    expect(useMCPStore.getState().settings.mcpConfig.mcpServers).toEqual({});
    expect(fetch).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Load Example' }));

    const editor = screen.getByLabelText<HTMLTextAreaElement>('Configuration JSON');
    const example = JSON.parse(editor.value);
    const parallel = example.mcpServers['parallel-search'];

    expect(parallel).toEqual({ type: 'streamable-http', url: 'https://search.parallel.ai/mcp' });
    expect(fetch).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem('mcp_settings')!).mcpConfig.mcpServers).toEqual({});

    fireEvent.change(editor, { target: { value: JSON.stringify({ mcpServers: { 'parallel-search': parallel } }) } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Configuration' }));
    await waitFor(() =>
      expect(useMCPStore.getState().settings.mcpConfig.mcpServers).toEqual({ 'parallel-search': parallel }),
    );
    expect(JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)).toEqual({
      mcpServers: { 'parallel-search': parallel },
    });
  });

  it('preserves saved servers while previewing the example, then saves only the edited configuration', async () => {
    localStorage.setItem('mcp_settings', JSON.stringify(existingSettings));
    render(<McpTab />);
    await waitFor(() => expect(useMCPStore.getState().isInitialized).toBe(true));
    vi.mocked(fetch).mockClear();

    fireEvent.click(screen.getByRole('button', { name: 'Load Example' }));

    const editor = screen.getByLabelText<HTMLTextAreaElement>('Configuration JSON');
    const parallel = JSON.parse(editor.value).mcpServers['parallel-search'];
    expect(useMCPStore.getState().settings).toEqual(existingSettings);
    expect(JSON.parse(localStorage.getItem('mcp_settings')!)).toEqual(existingSettings);
    expect(fetch).not.toHaveBeenCalled();

    const merged = { mcpServers: { ...existingSettings.mcpConfig.mcpServers, 'parallel-search': parallel } };
    fireEvent.change(editor, { target: { value: JSON.stringify(merged) } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Configuration' }));
    await waitFor(() => expect(useMCPStore.getState().settings.mcpConfig).toEqual(merged));
    expect(JSON.parse(localStorage.getItem('mcp_settings')!)).toEqual({ ...existingSettings, mcpConfig: merged });
  });

  it('does not save invalid JSON', async () => {
    render(<McpTab />);
    await waitFor(() => expect(useMCPStore.getState().isInitialized).toBe(true));
    fireEvent.change(screen.getByLabelText('Configuration JSON'), { target: { value: '{' } });
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Save Configuration' }).disabled).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });
});
