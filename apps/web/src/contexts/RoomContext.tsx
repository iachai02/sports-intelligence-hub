import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  getBoardState,
  getRoomActivity,
  getRoomDetails,
  getRoomState,
} from '../lib/api';
import type {
  ActivityLogEntry,
  BoardState,
  DraftState,
  RoomDetails,
  RoomMember,
  WsMessage,
  WsMemberEvent,
  WsPickReported,
  WsPickUndone,
} from '../lib/types';
import { useRoomWebSocket, type ConnectionStatus } from '../hooks/useRoomWebSocket';

interface RoomContextValue {
  roomId: number | null;
  room: RoomDetails | null;
  members: RoomMember[];
  myMemberId: number | null;
  isCommissioner: boolean;
  draftState: DraftState | null;
  boardState: BoardState | null;
  activities: ActivityLogEntry[];
  connectionStatus: ConnectionStatus;
  connectedUsers: number[];
  isLoading: boolean;
  error: string | null;
  refreshRoom: () => Promise<void>;
  refreshDraftState: () => Promise<void>;
  refreshBoard: () => Promise<void>;
  refreshActivities: () => Promise<void>;
  clearError: () => void;
}

const RoomContext = createContext<RoomContextValue | null>(null);

interface RoomProviderProps {
  roomId: number | null;
  userId: number | null;
  children: ReactNode;
}

export function RoomProvider({ roomId, userId, children }: RoomProviderProps) {
  const [room, setRoom] = useState<RoomDetails | null>(null);
  const [draftState, setDraftState] = useState<DraftState | null>(null);
  const [boardState, setBoardState] = useState<BoardState | null>(null);
  const [activities, setActivities] = useState<ActivityLogEntry[]>([]);
  const [connectedUsers, setConnectedUsers] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const myMemberId = room?.members.find(
    (m) => m.user_id === userId && !m.is_phantom
  )?.id ?? null;

  const isCommissioner = room?.commissioner_id === userId;

  const members = room?.members ?? [];

  const refreshRoom = useCallback(async () => {
    if (!roomId) return;
    try {
      const details = await getRoomDetails(roomId);
      setRoom(details);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load room');
    }
  }, [roomId]);

  const refreshDraftState = useCallback(async () => {
    if (!roomId) return;
    try {
      const state = await getRoomState(roomId);
      setDraftState(state);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load draft state');
    }
  }, [roomId]);

  const refreshBoard = useCallback(async () => {
    if (!roomId) return;
    try {
      const board = await getBoardState(roomId);
      setBoardState(board);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load board');
    }
  }, [roomId]);

  const refreshActivities = useCallback(async () => {
    if (!roomId) return;
    try {
      const logs = await getRoomActivity(roomId);
      setActivities(logs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load activity');
    }
  }, [roomId]);

  const clearError = useCallback(() => setError(null), []);

  // Handle incoming WebSocket messages
  const handleWsMessage = useCallback(
    (message: WsMessage) => {
      switch (message.type) {
        case 'pick_reported': {
          const pick = message as WsPickReported;
          // Add to activities
          setActivities((prev) => [
            {
              id: Date.now(),
              action_type: 'pick_reported',
              payload: {
                player_name: pick.player_name,
                team_name: pick.team_name,
                price: pick.price,
              },
              user_name: pick.reported_by,
              created_at: new Date().toISOString(),
            },
            ...prev,
          ]);
          // Refresh board and draft state
          refreshBoard();
          refreshDraftState();
          break;
        }
        case 'pick_undone': {
          const undo = message as WsPickUndone;
          setActivities((prev) => [
            {
              id: Date.now(),
              action_type: 'pick_undone',
              payload: {
                player_name: undo.player_name,
                team_name: undo.team_name,
              },
              user_name: undo.undone_by,
              created_at: new Date().toISOString(),
            },
            ...prev,
          ]);
          refreshBoard();
          refreshDraftState();
          break;
        }
        case 'member_joined':
        case 'member_left': {
          const evt = message as WsMemberEvent;
          setActivities((prev) => [
            {
              id: Date.now(),
              action_type: evt.type,
              payload: { user_name: evt.user_name },
              user_name: evt.user_name,
              created_at: new Date().toISOString(),
            },
            ...prev,
          ]);
          refreshRoom();
          break;
        }
        case 'member_connected':
        case 'member_disconnected': {
          const evt = message as WsMemberEvent;
          if (evt.connected_users) {
            setConnectedUsers(evt.connected_users);
          }
          // Update room to reflect online status
          refreshRoom();
          break;
        }
        case 'room_state_sync':
          refreshRoom();
          refreshBoard();
          refreshDraftState();
          refreshActivities();
          break;
      }
    },
    [refreshBoard, refreshDraftState, refreshRoom, refreshActivities]
  );

  const { status } = useRoomWebSocket({
    roomId,
    onMessage: handleWsMessage,
    enabled: !!roomId && room?.status === 'active',
  });

  // Initial load when roomId changes
  useEffect(() => {
    if (!roomId) {
      setRoom(null);
      setDraftState(null);
      setBoardState(null);
      setActivities([]);
      setConnectedUsers([]);
      return;
    }

    setIsLoading(true);
    Promise.all([
      refreshRoom(),
      refreshDraftState().catch(() => {}),
      refreshBoard().catch(() => {}),
      refreshActivities().catch(() => {}),
    ]).finally(() => setIsLoading(false));
  }, [roomId, refreshRoom, refreshDraftState, refreshBoard, refreshActivities]);

  const value: RoomContextValue = {
    roomId,
    room,
    members,
    myMemberId,
    isCommissioner,
    draftState,
    boardState,
    activities,
    connectionStatus: status,
    connectedUsers,
    isLoading,
    error,
    refreshRoom,
    refreshDraftState,
    refreshBoard,
    refreshActivities,
    clearError,
  };

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
}

export function useRoom() {
  const context = useContext(RoomContext);
  if (!context) {
    throw new Error('useRoom must be used within a RoomProvider');
  }
  return context;
}
