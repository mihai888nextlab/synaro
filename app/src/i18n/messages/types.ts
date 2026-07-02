export type MessageTree = {
  [key: string]: string | MessageTree;
};

export type Messages = MessageTree;
