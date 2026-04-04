import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAuth } from "../use-auth";
import * as authActions from "@/actions";
import * as projectActions from "@/actions/get-projects";
import * as createProjectActions from "@/actions/create-project";
import * as anonWorkTracker from "@/lib/anon-work-tracker";
import { useRouter } from "next/navigation";

vi.mock("next/navigation");
vi.mock("@/actions");
vi.mock("@/actions/get-projects");
vi.mock("@/actions/create-project");
vi.mock("@/lib/anon-work-tracker");

describe("useAuth", () => {
  const mockRouter = {
    push: vi.fn(),
  };

  const mockProject = {
    id: "project-123",
    name: "Test Project",
    userId: "user-123",
    messages: [],
    data: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as any).mockReturnValue(mockRouter);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("signIn", () => {
    it("should set isLoading to true while signing in", async () => {
      (authActions.signIn as any).mockResolvedValue({ success: false });
      (anonWorkTracker.getAnonWorkData as any).mockReturnValue(null);

      const { result } = renderHook(() => useAuth());

      expect(result.current.isLoading).toBe(false);

      let loadingDuringCall = false;
      const signInPromise = act(async () => {
        const promise = result.current.signIn("test@example.com", "password");
        loadingDuringCall = result.current.isLoading;
        await promise;
      });

      await signInPromise;

      expect(loadingDuringCall).toBe(true);
      expect(result.current.isLoading).toBe(false);
    });

    it("should call signInAction with correct credentials", async () => {
      (authActions.signIn as any).mockResolvedValue({ success: false });
      (anonWorkTracker.getAnonWorkData as any).mockReturnValue(null);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("test@example.com", "password123");
      });

      expect(authActions.signIn).toHaveBeenCalledWith(
        "test@example.com",
        "password123"
      );
    });

    it("should return the result from signInAction", async () => {
      const mockResult = { success: false, error: "Invalid credentials" };
      (authActions.signIn as any).mockResolvedValue(mockResult);
      (anonWorkTracker.getAnonWorkData as any).mockReturnValue(null);

      const { result } = renderHook(() => useAuth());

      let returnedResult;
      await act(async () => {
        returnedResult = await result.current.signIn("test@example.com", "wrong");
      });

      expect(returnedResult).toEqual(mockResult);
    });

    it("should handle successful signIn and navigate to first project", async () => {
      (authActions.signIn as any).mockResolvedValue({ success: true });
      (anonWorkTracker.getAnonWorkData as any).mockReturnValue(null);
      (projectActions.getProjects as any).mockResolvedValue([mockProject]);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("test@example.com", "password");
      });

      expect(mockRouter.push).toHaveBeenCalledWith("/project-123");
    });

    it("should handle successful signIn with anonymous work", async () => {
      const anonWork = {
        messages: [{ role: "user", content: "Create a button" }],
        fileSystemData: { file1: "content" },
      };
      (authActions.signIn as any).mockResolvedValue({ success: true });
      (anonWorkTracker.getAnonWorkData as any).mockReturnValue(anonWork);
      (createProjectActions.createProject as any).mockResolvedValue(mockProject);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("test@example.com", "password");
      });

      expect(createProjectActions.createProject).toHaveBeenCalledWith({
        name: expect.stringMatching(/Design from/),
        messages: anonWork.messages,
        data: anonWork.fileSystemData,
      });
      expect(anonWorkTracker.clearAnonWork).toHaveBeenCalled();
      expect(mockRouter.push).toHaveBeenCalledWith("/project-123");
    });

    it("should skip anonymous work if messages are empty", async () => {
      const anonWork = {
        messages: [],
        fileSystemData: { file1: "content" },
      };
      (authActions.signIn as any).mockResolvedValue({ success: true });
      (anonWorkTracker.getAnonWorkData as any).mockReturnValue(anonWork);
      (projectActions.getProjects as any).mockResolvedValue([mockProject]);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("test@example.com", "password");
      });

      expect(createProjectActions.createProject).not.toHaveBeenCalled();
      expect(mockRouter.push).toHaveBeenCalledWith("/project-123");
    });

    it("should create new project if no existing projects", async () => {
      (authActions.signIn as any).mockResolvedValue({ success: true });
      (anonWorkTracker.getAnonWorkData as any).mockReturnValue(null);
      (projectActions.getProjects as any).mockResolvedValue([]);
      (createProjectActions.createProject as any).mockResolvedValue(mockProject);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("test@example.com", "password");
      });

      expect(createProjectActions.createProject).toHaveBeenCalledWith({
        name: expect.stringMatching(/New Design #\d+/),
        messages: [],
        data: {},
      });
      expect(mockRouter.push).toHaveBeenCalledWith("/project-123");
    });

    it("should not navigate if signIn fails", async () => {
      (authActions.signIn as any).mockResolvedValue({
        success: false,
        error: "Invalid credentials",
      });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("test@example.com", "wrong");
      });

      expect(mockRouter.push).not.toHaveBeenCalled();
    });

    it("should reset isLoading even if an error occurs", async () => {
      (authActions.signIn as any).mockRejectedValue(
        new Error("Network error")
      );
      (anonWorkTracker.getAnonWorkData as any).mockReturnValue(null);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        try {
          await result.current.signIn("test@example.com", "password");
        } catch {
          // Expected error
        }
      });

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("signUp", () => {
    it("should set isLoading to true while signing up", async () => {
      (authActions.signUp as any).mockResolvedValue({ success: false });
      (anonWorkTracker.getAnonWorkData as any).mockReturnValue(null);

      const { result } = renderHook(() => useAuth());

      expect(result.current.isLoading).toBe(false);

      let loadingDuringCall = false;
      const signUpPromise = act(async () => {
        const promise = result.current.signUp("test@example.com", "password");
        loadingDuringCall = result.current.isLoading;
        await promise;
      });

      await signUpPromise;

      expect(loadingDuringCall).toBe(true);
      expect(result.current.isLoading).toBe(false);
    });

    it("should call signUpAction with correct credentials", async () => {
      (authActions.signUp as any).mockResolvedValue({ success: false });
      (anonWorkTracker.getAnonWorkData as any).mockReturnValue(null);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("newuser@example.com", "securepass");
      });

      expect(authActions.signUp).toHaveBeenCalledWith(
        "newuser@example.com",
        "securepass"
      );
    });

    it("should return the result from signUpAction", async () => {
      const mockResult = { success: false, error: "Email already exists" };
      (authActions.signUp as any).mockResolvedValue(mockResult);
      (anonWorkTracker.getAnonWorkData as any).mockReturnValue(null);

      const { result } = renderHook(() => useAuth());

      let returnedResult;
      await act(async () => {
        returnedResult = await result.current.signUp(
          "existing@example.com",
          "password"
        );
      });

      expect(returnedResult).toEqual(mockResult);
    });

    it("should handle successful signUp and navigate to first project", async () => {
      (authActions.signUp as any).mockResolvedValue({ success: true });
      (anonWorkTracker.getAnonWorkData as any).mockReturnValue(null);
      (projectActions.getProjects as any).mockResolvedValue([mockProject]);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("newuser@example.com", "password");
      });

      expect(mockRouter.push).toHaveBeenCalledWith("/project-123");
    });

    it("should handle successful signUp with anonymous work", async () => {
      const anonWork = {
        messages: [{ role: "user", content: "Create a card component" }],
        fileSystemData: { components: { Card: "content" } },
      };
      (authActions.signUp as any).mockResolvedValue({ success: true });
      (anonWorkTracker.getAnonWorkData as any).mockReturnValue(anonWork);
      (createProjectActions.createProject as any).mockResolvedValue(mockProject);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("newuser@example.com", "password");
      });

      expect(createProjectActions.createProject).toHaveBeenCalledWith({
        name: expect.stringMatching(/Design from/),
        messages: anonWork.messages,
        data: anonWork.fileSystemData,
      });
      expect(anonWorkTracker.clearAnonWork).toHaveBeenCalled();
      expect(mockRouter.push).toHaveBeenCalledWith("/project-123");
    });

    it("should create new project if no existing projects", async () => {
      (authActions.signUp as any).mockResolvedValue({ success: true });
      (anonWorkTracker.getAnonWorkData as any).mockReturnValue(null);
      (projectActions.getProjects as any).mockResolvedValue([]);
      (createProjectActions.createProject as any).mockResolvedValue(mockProject);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("newuser@example.com", "password");
      });

      expect(createProjectActions.createProject).toHaveBeenCalledWith({
        name: expect.stringMatching(/New Design #\d+/),
        messages: [],
        data: {},
      });
      expect(mockRouter.push).toHaveBeenCalledWith("/project-123");
    });

    it("should not navigate if signUp fails", async () => {
      (authActions.signUp as any).mockResolvedValue({
        success: false,
        error: "Email already exists",
      });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("existing@example.com", "password");
      });

      expect(mockRouter.push).not.toHaveBeenCalled();
    });

    it("should reset isLoading even if an error occurs", async () => {
      (authActions.signUp as any).mockRejectedValue(
        new Error("Server error")
      );
      (anonWorkTracker.getAnonWorkData as any).mockReturnValue(null);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        try {
          await result.current.signUp("test@example.com", "password");
        } catch {
          // Expected error
        }
      });

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("Post-sign-in navigation", () => {
    it("should prioritize anonymous work over existing projects", async () => {
      const anonWork = {
        messages: [{ role: "user", content: "Create a button" }],
        fileSystemData: {},
      };
      const existingProject = {
        ...mockProject,
        id: "existing-project-123",
      };

      (authActions.signIn as any).mockResolvedValue({ success: true });
      (anonWorkTracker.getAnonWorkData as any).mockReturnValue(anonWork);
      (createProjectActions.createProject as any).mockResolvedValue(mockProject);
      (projectActions.getProjects as any).mockResolvedValue([existingProject]);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("test@example.com", "password");
      });

      expect(createProjectActions.createProject).toHaveBeenCalled();
      expect(mockRouter.push).toHaveBeenCalledWith("/project-123");
      expect(mockRouter.push).not.toHaveBeenCalledWith("/existing-project-123");
    });

    it("should navigate to the first project (most recent)", async () => {
      const oldProject = { ...mockProject, id: "old-project" };
      const recentProject = { ...mockProject, id: "recent-project" };

      (authActions.signUp as any).mockResolvedValue({ success: true });
      (anonWorkTracker.getAnonWorkData as any).mockReturnValue(null);
      (projectActions.getProjects as any).mockResolvedValue([
        recentProject,
        oldProject,
      ]);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("test@example.com", "password");
      });

      expect(mockRouter.push).toHaveBeenCalledWith("/recent-project");
    });

    it("should generate a random name for new projects", async () => {
      (authActions.signIn as any).mockResolvedValue({ success: true });
      (anonWorkTracker.getAnonWorkData as any).mockReturnValue(null);
      (projectActions.getProjects as any).mockResolvedValue([]);
      (createProjectActions.createProject as any).mockResolvedValue(mockProject);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("test@example.com", "password");
      });

      const call = (createProjectActions.createProject as any).mock.calls[0][0];
      expect(call.name).toMatch(/New Design #\d+/);
    });

    it("should handle null anonWorkData gracefully", async () => {
      (authActions.signIn as any).mockResolvedValue({ success: true });
      (anonWorkTracker.getAnonWorkData as any).mockReturnValue(null);
      (projectActions.getProjects as any).mockResolvedValue([mockProject]);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("test@example.com", "password");
      });

      expect(mockRouter.push).toHaveBeenCalledWith("/project-123");
    });

    it("should create project with correct message and file data from anonymous work", async () => {
      const messages = [
        { role: "user", content: "Create a sidebar" },
        { role: "assistant", content: "Here is your sidebar" },
      ];
      const fileSystemData = {
        Sidebar: { type: "file", content: "export const Sidebar = ..." },
      };
      const anonWork = { messages, fileSystemData };

      (authActions.signUp as any).mockResolvedValue({ success: true });
      (anonWorkTracker.getAnonWorkData as any).mockReturnValue(anonWork);
      (createProjectActions.createProject as any).mockResolvedValue(mockProject);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("test@example.com", "password");
      });

      expect(createProjectActions.createProject).toHaveBeenCalledWith({
        name: expect.stringMatching(/Design from/),
        messages,
        data: fileSystemData,
      });
    });
  });

  describe("Hook lifecycle", () => {
    it("should initialize with isLoading as false", () => {
      const { result } = renderHook(() => useAuth());

      expect(result.current.isLoading).toBe(false);
    });

    it("should return signIn and signUp functions", () => {
      const { result } = renderHook(() => useAuth());

      expect(typeof result.current.signIn).toBe("function");
      expect(typeof result.current.signUp).toBe("function");
    });

    it("should be able to call signIn and signUp multiple times", async () => {
      (authActions.signIn as any).mockResolvedValue({ success: false });
      (authActions.signUp as any).mockResolvedValue({ success: false });
      (anonWorkTracker.getAnonWorkData as any).mockReturnValue(null);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("user1@example.com", "pass1");
      });

      await act(async () => {
        await result.current.signUp("user2@example.com", "pass2");
      });

      await act(async () => {
        await result.current.signIn("user1@example.com", "pass1");
      });

      expect(authActions.signIn).toHaveBeenCalledTimes(2);
      expect(authActions.signUp).toHaveBeenCalledTimes(1);
    });
  });

  describe("Error handling", () => {
    it("should handle signInAction throwing an error", async () => {
      (authActions.signIn as any).mockRejectedValue(
        new Error("Network error")
      );
      (anonWorkTracker.getAnonWorkData as any).mockReturnValue(null);

      const { result } = renderHook(() => useAuth());

      await expect(
        act(async () => {
          await result.current.signIn("test@example.com", "password");
        })
      ).rejects.toThrow("Network error");
    });

    it("should handle createProject throwing an error after signIn", async () => {
      const anonWork = {
        messages: [{ role: "user", content: "test" }],
        fileSystemData: {},
      };

      (authActions.signIn as any).mockResolvedValue({ success: true });
      (anonWorkTracker.getAnonWorkData as any).mockReturnValue(anonWork);
      (createProjectActions.createProject as any).mockRejectedValue(
        new Error("Database error")
      );

      const { result } = renderHook(() => useAuth());

      await expect(
        act(async () => {
          await result.current.signIn("test@example.com", "password");
        })
      ).rejects.toThrow("Database error");
    });

    it("should handle getProjects throwing an error", async () => {
      (authActions.signIn as any).mockResolvedValue({ success: true });
      (anonWorkTracker.getAnonWorkData as any).mockReturnValue(null);
      (projectActions.getProjects as any).mockRejectedValue(
        new Error("Fetch error")
      );

      const { result } = renderHook(() => useAuth());

      await expect(
        act(async () => {
          await result.current.signIn("test@example.com", "password");
        })
      ).rejects.toThrow("Fetch error");
    });
  });
});
