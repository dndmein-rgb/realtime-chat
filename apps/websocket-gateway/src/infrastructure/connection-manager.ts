export class ConnectionManager{
  // socketId → userId
  private socketToUser = new Map<string, string>();
  // userId → Set of socketIds (one user can have multiple tabs/devices)
  private userToSockets = new Map<string, Set<string>>();
  // roomId → Set of socketIds that joined this room
  private roomToSockets = new Map<string, Set<string>>()

  addConnection(socketId: string, userId: string): void{
    this.socketToUser.set(socketId, userId)
    let sockets = this.userToSockets.get(userId)
    if (!sockets) {
      sockets = new Set()
      this.userToSockets.set(userId,sockets)
    }
    sockets.add(socketId)
  }
  removeConnection(socketId: string): { userId: string | null; wasLastConnection: boolean }{
    const userId = this.socketToUser.get(socketId) ?? null
    this.socketToUser.delete(socketId)
    if (!userId) {
      return {
        userId: null,
        wasLastConnection:false
      }
    }
    const sockets = this.userToSockets.get(userId)
    if (sockets) {
      sockets.delete(socketId)
      if (sockets.size === 0) {
        this.userToSockets.delete(userId)
        // also leave every room this socket was in
        this.leaveAllRooms(socketId);
                return { userId, wasLastConnection: true };
      }
    }
    this.leaveAllRooms(socketId);
            return { userId, wasLastConnection: false };
  }
  joinRoom(socketId: string, roomId: string): void{
    let sockets = this.roomToSockets.get(roomId)
    if (!sockets) {
      sockets = new Set()
      this.roomToSockets.set(roomId,sockets)
    }
    sockets.add(socketId)
  }
  leaveRoom(socketId: string, roomId: string): void{
    const sockets = this.roomToSockets.get(roomId);
    if (sockets) {
      sockets.delete(socketId)
      if (sockets.size === 0) {
        this.roomToSockets.delete(roomId)
      }
    }
  }
  private leaveAllRooms(socketId: string):void {
    for (const [roomId,sockets] of this.roomToSockets) {
      if (sockets.has(socketId)) {
        sockets.delete(socketId)
        if (sockets.size === 0) {
          this.roomToSockets.delete(roomId)
        }
      }
    }
  }
  getSocketsInRoom(roomId: string): string[]{
    return Array.from(this.roomToSockets.get(roomId)??[])
  }
  getUserId(socketId: string): string | undefined{
    return this.socketToUser.get(socketId)
  }
  // useful for debugging
    getStats() {
      return {
        connections: this.socketToUser.size,
        users: this.userToSockets.size,
        rooms: this.roomToSockets.size,
      };
    }

getRoomsForUser(userId: string): string[]{
  const socketIds = this.userToSockets.get(userId);
  if (!socketIds) {
    return []
  }
  const rooms = new Set<string>();
  for (const [roomId, sockets] of this.roomToSockets) {
    for (const sid of sockets) {
      if (socketIds.has(sid)) {
        rooms.add(roomId)
        break
      }
    }
  }
  return Array.from(rooms);
  }
  
  getSocketsForUser(userId: string): string[] {
    return Array.from(this.userToSockets.get(userId) ?? []);
  }  
}
  
  export const connectionManager = new ConnectionManager();