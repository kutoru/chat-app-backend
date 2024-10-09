import FileInfo from "./FileInfo";

type Message = {
  id: number;
  room_id: number;
  sender_id?: number;
  text: string;
  created: number;
  files?: FileInfo[];
};

export default Message;
