import type { Socket } from 'socket.io';

interface ClassroomSocketData {
  userId: string;
  role: string;
  currentLesson: string | null;
}

export function getClassroomSocketData(socket: Socket): ClassroomSocketData {
  const data = socket.data as Partial<ClassroomSocketData>;
  return {
    userId: data.userId ?? '',
    role: data.role ?? '',
    currentLesson: data.currentLesson ?? null,
  };
}

export function setClassroomSocketData(
  socket: Socket,
  patch: Partial<ClassroomSocketData>,
): void {
  const current = getClassroomSocketData(socket);
  socket.data = { ...current, ...patch };
}
