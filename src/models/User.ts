type User = {
  id: number;
  username: string;
  password: string;
  profile_image?: string;
  role: "user" | "admin";
  created: number;
};

export default User;
