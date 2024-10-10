enum AppError {
  InvalidCredentials = "Invalid credentials",
  InvalidCredentialsFormat = "Invalid credentials format",
  UserExists = "User already exists",
  UserDoesNotExist = "This user does not exist",
  SelfChatIsNotSupported = "You cannot chat with yourself",
  InvalidFileType = "Invalid file type",
  Forbidden = "Forbidden",
  InvalidFields = "Invalid fields",
  IsAlreadyMember = "The user is already in this group",
  NewPasswordRepeated = "New password should not match the old one",
}

export default AppError;
