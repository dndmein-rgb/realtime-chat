import { RoomRepository } from "./room.repository.js";
import { RoomService } from "./room.service.js";

const roomRepository = new RoomRepository();
export const roomService = new RoomService(roomRepository);