type Room = {
  id: number;
  name?: string;
  cover_image?: string;
  type: "direct" | "group";
  created: number;
};

export default Room;
