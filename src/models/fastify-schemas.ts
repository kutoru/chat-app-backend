export const loginSchema = {
  body: {
    type: "object",
    properties: {
      username: { type: "string" },
      password: { type: "string" },
    },
    required: ["username", "password"],
  },
};

export const passPostSchema = {
  body: {
    type: "object",
    properties: {
      oldPassword: { type: "string" },
      newPassword: { type: "string" },
    },
    required: ["oldPassword", "newPassword"],
  },
};

export const roomsDirectPostSchema = {
  body: {
    type: "object",
    properties: {
      username: { type: "string" },
    },
    required: ["username"],
  },
};

export const roomsGroupPostSchema = {
  body: {
    type: "object",
    properties: {
      groupName: { type: "string" },
    },
    required: ["groupName"],
  },
};

export const roomsIdInvitePostSchema = {
  body: {
    type: "object",
    properties: {
      username: { type: "string" },
    },
    required: ["username"],
  },
};
