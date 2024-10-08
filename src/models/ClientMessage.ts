import File from "./File";

type ClientMessage = {
  id: number;
  room_id: number;
  sender_id?: number;
  temp_id?: number;
  profile_image?: string;
  username?: string;
  from_self: boolean;
  text: string;
  created: number;
  files?: File[];
};

export default ClientMessage;
