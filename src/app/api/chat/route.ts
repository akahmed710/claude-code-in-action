import type { FileNode } from "@/lib/file-system";
import { VirtualFileSystem } from "@/lib/file-system";
import { streamText, createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { buildStrReplaceTool } from "@/lib/tools/str-replace";
import { buildFileManagerTool } from "@/lib/tools/file-manager";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getLanguageModel } from "@/lib/provider";
import { generationPrompt } from "@/lib/prompts/generation";

export async function POST(req: Request) {
  const {
    messages,
    files,
    projectId,
  }: { messages: any[]; files: Record<string, FileNode>; projectId?: string } =
    await req.json();

  messages.unshift({
    role: "system",
    content: generationPrompt,
    providerOptions: {
      anthropic: { cacheControl: { type: "ephemeral" } },
    },
  });

  // Reconstruct the VirtualFileSystem from serialized data
  const fileSystem = new VirtualFileSystem();
  fileSystem.deserializeFromNodes(files);

  const model = getLanguageModel();
  const isMockProvider = !process.env.ANTHROPIC_API_KEY;

  return createUIMessageStreamResponse({
    stream: createUIMessageStream({
      execute: ({ writer }) => {
        const result = streamText({
          model,
          messages,
          maxTokens: 10_000,
          maxSteps: isMockProvider ? 4 : 40,
          onError: (err: any) => {
            console.error(err);
          },
          tools: {
            str_replace_editor: buildStrReplaceTool(fileSystem),
            file_manager: buildFileManagerTool(fileSystem),
          },
          onChunk: ({ chunk }) => {
            if (chunk.type === "tool-result") {
              writer.write({ type: "data-vfs-update", data: { files: fileSystem.serialize() } } as any);
            }
          },
          onFinish: async ({ response }) => {
            writer.write({ type: "data-vfs-update", data: { files: fileSystem.serialize() } } as any);

            if (projectId) {
              try {
                const session = await getSession();
                if (!session) {
                  console.error("User not authenticated, cannot save project");
                  return;
                }

                const allMessages = [
                  ...messages.filter((m) => m.role !== "system"),
                  ...(response.messages || []),
                ];

                await prisma.project.update({
                  where: { id: projectId, userId: session.userId },
                  data: {
                    messages: JSON.stringify(allMessages),
                    data: JSON.stringify(fileSystem.serialize()),
                  },
                });
              } catch (error) {
                console.error("Failed to save project data:", error);
              }
            }
          },
        });

        writer.merge(result.toUIMessageStream());
      },
    }),
  });
}

export const maxDuration = 120;
