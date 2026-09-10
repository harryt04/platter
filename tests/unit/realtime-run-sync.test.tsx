import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RealtimeRunSync } from '@/components/states/realtime-run-sync'

const realtime = vi.hoisted(() => {
  const handlers = new Map<string, (...args: unknown[]) => void>()
  const socket = {
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      handlers.set(event, handler)
      return socket
    }),
    off: vi.fn((event: string) => {
      handlers.delete(event)
      return socket
    }),
    emit: vi.fn(),
    disconnect: vi.fn(),
  }
  return { handlers, io: vi.fn(() => socket), socket }
})

const refresh = vi.hoisted(() => vi.fn())

vi.mock('socket.io-client', () => ({ io: realtime.io }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))

describe('RealtimeRunSync', () => {
  afterEach(() => {
    vi.useRealTimers()
    cleanup()
  })

  beforeEach(() => {
    realtime.handlers.clear()
    realtime.io.mockClear()
    realtime.socket.on.mockClear()
    realtime.socket.off.mockClear()
    realtime.socket.emit.mockClear()
    realtime.socket.disconnect.mockClear()
    refresh.mockClear()
  })

  it('joins the list room and refreshes once for a newer matching run event', async () => {
    render(
      <RealtimeRunSync
        currentUserId="member-1"
        listId="list-1"
        revision={4}
        runId="run-1"
      />,
    )

    act(() => realtime.handlers.get('connect')?.())
    expect(realtime.socket.emit).toHaveBeenCalledWith(
      'foundation:join',
      'list-1',
    )
    expect(screen.getByRole('status')).toHaveTextContent('Live updates on')

    const event = {
      type: 'grocery.purchased.marked',
      listId: 'list-1',
      runId: 'run-1',
      revision: 5,
      operationId: 'operation-1',
      actorId: 'member-2',
      occurredAt: '2026-09-10T12:00:00.000Z',
    }
    act(() => realtime.handlers.get('run:mutation')?.(event))
    act(() =>
      realtime.handlers.get('run:mutation')?.({ ...event, revision: 4 }),
    )
    act(() =>
      realtime.handlers.get('run:mutation')?.({
        ...event,
        listId: 'other-list',
      }),
    )

    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
  })

  it('refreshes once when another member completes the current run', async () => {
    render(
      <RealtimeRunSync
        currentUserId="member-1"
        listId="list-1"
        revision={4}
        runId="run-1"
      />,
    )

    const completion = {
      type: 'run.completed',
      listId: 'list-1',
      runId: 'run-1',
      nextRunId: 'run-2',
      operationId: 'completion-1',
      completedByUserId: 'member-2',
      occurredAt: '2026-09-10T12:00:00.000Z',
    }
    act(() => realtime.handlers.get('run:completed')?.(completion))
    act(() => realtime.handlers.get('run:completed')?.(completion))

    expect(refresh).toHaveBeenCalledOnce()
    expect(
      screen.getByText(/Member member-2 completed this run/),
    ).toHaveTextContent('A fresh shopping run is ready.')
  })

  it('settles on the replacement run after a completion refresh', () => {
    const { rerender } = render(
      <RealtimeRunSync
        currentUserId="member-1"
        listId="list-1"
        revision={4}
        runId="run-1"
      />,
    )

    act(() =>
      realtime.handlers.get('run:completed')?.({
        type: 'run.completed',
        listId: 'list-1',
        runId: 'run-1',
        nextRunId: 'run-2',
        operationId: 'completion-1',
        completedByUserId: 'member-2',
        occurredAt: '2026-09-10T12:00:00.000Z',
      }),
    )
    expect(screen.getByText('Updating from another device')).toBeInTheDocument()

    rerender(
      <RealtimeRunSync
        currentUserId="member-1"
        listId="list-1"
        revision={0}
        runId="run-2"
      />,
    )

    expect(screen.getByRole('status')).toHaveTextContent('Live updates on')
    expect(
      screen.queryByText(/A fresh shopping run is ready/),
    ).not.toBeInTheDocument()
    expect(refresh).toHaveBeenCalledOnce()
  })

  it('ignores malformed and unrelated completion events', () => {
    render(
      <RealtimeRunSync
        currentUserId="member-1"
        listId="list-1"
        revision={4}
        runId="run-1"
      />,
    )

    act(() => {
      realtime.handlers.get('run:completed')?.({
        type: 'run.completed',
        listId: 'other-list',
        runId: 'run-1',
        nextRunId: 'run-2',
        operationId: 'completion-1',
        completedByUserId: 'member-2',
        occurredAt: 'not-a-date',
      })
    })

    expect(refresh).not.toHaveBeenCalled()
  })

  it('does not refresh for malformed events or an event from another run', () => {
    render(
      <RealtimeRunSync
        currentUserId="member-1"
        listId="list-1"
        revision={4}
        runId="run-1"
      />,
    )

    act(() => {
      realtime.handlers.get('run:mutation')?.({
        type: 'grocery.purchased.marked',
        listId: 'list-1',
        runId: 'run-2',
        revision: 5,
        operationId: 'operation-1',
        actorId: 'member-2',
        occurredAt: 'not-a-date',
      })
    })

    expect(refresh).not.toHaveBeenCalled()
  })

  it('recovers from a revision gap with one server snapshot refresh', async () => {
    render(
      <RealtimeRunSync
        currentUserId="member-1"
        listId="list-1"
        revision={4}
        runId="run-1"
      />,
    )

    act(() =>
      realtime.handlers.get('run:mutation')?.({
        type: 'grocery.purchased.marked',
        listId: 'list-1',
        runId: 'run-1',
        revision: 7,
        operationId: 'operation-7',
        actorId: 'member-2',
        occurredAt: '2026-09-10T12:00:00.000Z',
      }),
    )
    act(() =>
      realtime.handlers.get('run:mutation')?.({
        type: 'grocery.purchased.marked',
        listId: 'list-1',
        runId: 'run-1',
        revision: 8,
        operationId: 'operation-8',
        actorId: 'member-2',
        occurredAt: '2026-09-10T12:00:01.000Z',
      }),
    )

    expect(screen.getByRole('status')).toHaveTextContent(
      'Catching up with live updates',
    )
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce())
  })

  it('only clears recovery after the refreshed snapshot reports its revision', () => {
    const { rerender } = render(
      <RealtimeRunSync
        currentUserId="member-1"
        listId="list-1"
        revision={4}
        runId="run-1"
      />,
    )

    act(() =>
      realtime.handlers.get('run:mutation')?.({
        type: 'grocery.purchased.marked',
        listId: 'list-1',
        runId: 'run-1',
        revision: 7,
        operationId: 'operation-7',
        actorId: 'member-2',
        occurredAt: '2026-09-10T12:00:00.000Z',
      }),
    )
    expect(screen.getByRole('status')).toHaveTextContent(
      'Catching up with live updates',
    )

    rerender(
      <RealtimeRunSync
        currentUserId="member-1"
        listId="list-1"
        revision={7}
        runId="run-1"
      />,
    )

    expect(screen.getByRole('status')).toHaveTextContent('Live updates on')
  })

  it('batches remote change announcements and ignores the current shopper', () => {
    vi.useFakeTimers()
    render(
      <RealtimeRunSync
        currentUserId="member-1"
        listId="list-1"
        revision={4}
        runId="run-1"
      />,
    )

    const emit = (type: string, revision: number, actorId = 'member-2') =>
      realtime.handlers.get('run:mutation')?.({
        type,
        listId: 'list-1',
        runId: 'run-1',
        revision,
        operationId: `operation-${revision}`,
        actorId,
        occurredAt: `2026-09-10T12:00:0${revision}.000Z`,
      })

    act(() => emit('grocery.purchased.marked', 5, 'member-1'))
    act(() => emit('grocery.purchased.marked', 6))
    act(() => emit('grocery.amount-override.set', 7))

    expect(screen.queryByText(/Another shopper made/)).not.toBeInTheDocument()
    act(() => vi.advanceTimersByTime(600))

    expect(
      screen.getByText(
        'Another shopper made 2 shared changes: Purchased status and shopping amount.',
      ),
    ).toBeInTheDocument()
  })
})
