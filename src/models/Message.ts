import File from "./File";

type Message = {
  id: number;
  room_id: number;
  sender_id?: number;
  text: string;
  created: number;
  files?: File[];
};

export default Message;
