"use client";

import {
  createContext,
  useContext,
  ReactNode,
  useEffect,
  useState,
  ChangeEvent,
  FormEvent,
} from "react";
import { useChat as useAIChat } from "@ai-sdk/react";
import type { UIMessage } from "@ai-sdk/react";
import { useFileSystem } from "./file-system-context";
import { setHasAnonWork } from "@/lib/anon-work-tracker";

interface ChatContextProps {
  projectId?: string;
  initialMessages?: UIMessage[];
}

interface ChatContextType {
  messages: UIMessage[];
  input: string;
  handleInputChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  handleSubmit: (e: FormEvent<HTMLFormElement>) => void;
  status: string;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({
  children,
  projectId,
  initialMessages = [],
}: ChatContextProps & { children: ReactNode }) {
  const { fileSystem, loadFromSerialized } = useFileSystem();
  const [input, setInput] = useState("");

  const {
    messages,
    sendMessage,
    status,
  } = useAIChat({
    api: "/api/chat",
    initialMessages,
    onData: (dataItems) => {
      for (const item of dataItems) {
        if ((item as any)?.type === "data-vfs-update") {
          loadFromSerialized((item as any).data.files);
        }
      }
    },
  });

  const handleInputChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim()) return;

    sendMessage({
      text: input,
    }, {
      body: {
        files: fileSystem.serialize(),
        projectId,
      },
    });

    setInput("");
  };

  // Track anonymous work
  useEffect(() => {
    if (!projectId && messages.length > 0) {
      setHasAnonWork(messages, fileSystem.serialize());
    }
  }, [messages, fileSystem, projectId]);

  return (
    <ChatContext.Provider
      value={{
        messages,
        input,
        handleInputChange,
        handleSubmit,
        status: status === "streaming" ? "streaming" : status === "submitted" ? "submitted" : "idle",
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
}