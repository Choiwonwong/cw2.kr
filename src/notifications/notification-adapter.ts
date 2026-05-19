export type NotificationEmbedField = {
  name: string;
  value: string;
  inline?: boolean;
};

export type NotificationEmbed = {
  title?: string;
  description?: string;
  url?: string;
  fields?: NotificationEmbedField[];
  timestamp?: string;
};

export type NotificationMessage = {
  content?: string;
  username?: string;
  embeds?: NotificationEmbed[];
};

export type NotificationAdapter = {
  send(message: NotificationMessage): Promise<void>;
};
