import { RoomRepository } from "../room/room.repository.js";
import { MessageRepository } from "./message.repository.js";
import { MessageService } from "./message.service.js";

const messageRepository = new MessageRepository();
const roomRepository = new RoomRepository();

export const messageService=new MessageService(messageRepository,roomRepository)