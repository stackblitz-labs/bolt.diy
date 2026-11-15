import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { createMemoryRouter, RouterProvider, useParams } from 'react-router';
import { expect, it } from 'vitest';
import routes from './routes';

function ChatSession() {
  const [message, setMessage] = useState('');
  const { id } = useParams();

  return (
    <>
      <input aria-label="Draft message" value={message} onChange={(event) => setMessage(event.target.value)} />
      <span>{id || 'new chat'}</span>
    </>
  );
}

it('preserves the mounted chat when a new chat receives its persisted route', async () => {
  const chatLayout = routes.find((route) => route.file === 'routes/_index.tsx');

  const router = createMemoryRouter([
    {
      element: <ChatSession />,
      children: chatLayout?.children?.map((route) =>
        route.index ? { index: true, element: null } : { path: route.path, element: null },
      ),
    },
  ]);

  render(<RouterProvider router={router} />);
  fireEvent.change(screen.getByLabelText('Draft message'), { target: { value: 'Build my app' } });

  await act(async () => {
    await router.navigate('/chat/3', { replace: true });
  });

  expect(screen.getByLabelText('Draft message')).toHaveProperty('value', 'Build my app');
  expect(screen.getByText('3')).toBeDefined();
});
