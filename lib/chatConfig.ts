export type OperatorStatus = "online" | "usually-fast" | "offline";

export const websiteChatConfig = {
  status: "usually-fast" as OperatorStatus,
  labels: {
    "online": "Online now",
    "usually-fast": "Usually replies in under 5 minutes",
    "offline": "Offline — leave a message",
  },
};

