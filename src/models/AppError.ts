enum AppError {
  InvalidCredentials = "Invalid credentials",
  InvalidCredentialsFormat = "Invalid credentials format",
  UserExists = "User already exists",
  UserDoesNotExist = "This user does not exist",
  SelfChatIsNotSupported = "You cannot chat with yourself",
  InvalidFileType = "Invalid file type",
}

export default AppError;
