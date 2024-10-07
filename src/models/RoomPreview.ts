import Room from "./Room";

type RoomPreview = Room & {
  message_text: string;
  message_created: number;
};

export default RoomPreview;
