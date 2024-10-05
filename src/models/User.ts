import UserRole from "./UserRole";

type User = {
  id: number;
  username: string;
  password: string;
  profile_image?: string;
  role: UserRole;
  created: number;
};

export default User;
