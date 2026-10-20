import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installFakeCamera } from "../test/fakeCamera";
import { CAMERA_FPS, cameraErrorMessage, useCamera } from "./useCamera";

const FRAME_MS = 1000 / CAMERA_FPS;
const OPTIONS = { width: 80 };

let camera;
let sendFrame;
let showToast;

beforeEach(() => {
  vi.useFakeTimers();
  camera = installFakeCamera();
  sendFrame = vi.fn().mockReturnValue(true);
  showToast = vi.fn();
});

afterEach(() => {
  vi.useRealTimers();
});

const setup = (props = {}) =>
  renderHook((current) => useCamera(current), {
    initialProps: { sendFrame, options: OPTIONS, showToast, ...props },
  });

const startCamera = async (hook) => {
  await act(async () => {
    await hook.result.current.start();
  });
};

const tick = (frames = 1) =>
  act(() => vi.advanceTimersByTime(FRAME_MS * frames));

describe("starting", () => {
  it("asks for the video only, never the microphone", async () => {
    const hook = setup();
    await startCamera(hook);

    expect(camera.getUserMedia).toHaveBeenCalledWith(
      expect.objectContaining({ audio: false, video: expect.anything() }),
    );
    expect(hook.result.current.active).toBe(true);
    expect(hook.result.current.starting).toBe(false);
  });

  it("is not active before it has started, and stays inactive if refused", async () => {
    camera.getUserMedia.mockRejectedValue(
      Object.assign(new Error("denied"), { name: "NotAllowedError" }),
    );
    const hook = setup();
    await startCamera(hook);

    expect(hook.result.current.active).toBe(false);
    expect(hook.result.current.starting).toBe(false);
    expect(showToast).toHaveBeenCalledWith(
      "Camera access was refused",
      "error",
    );
  });

  it("ignores a second start while it is on", async () => {
    const hook = setup();
    await startCamera(hook);
    await startCamera(hook);

    expect(camera.getUserMedia).toHaveBeenCalledTimes(1);
  });

  it("releases the camera if the video can't play", async () => {
    camera.play.mockRejectedValue(new Error("no frames"));
    const hook = setup();
    await startCamera(hook);

    expect(camera.track.stop).toHaveBeenCalled();
    expect(hook.result.current.active).toBe(false);
    expect(showToast).toHaveBeenCalledWith(
      expect.stringContaining("no frames"),
      "error",
    );
  });
});

describe("capturing", () => {
  it("sends a frame at the camera frame rate, as base64 without the prefix", async () => {
    const hook = setup();
    await startCamera(hook);

    expect(sendFrame).not.toHaveBeenCalled();
    tick();
    expect(sendFrame).toHaveBeenCalledTimes(1);
    expect(sendFrame).toHaveBeenCalledWith("QUJD", OPTIONS);

    tick(2);
    expect(sendFrame).toHaveBeenCalledTimes(3);
  });

  it("uses the options that are current when the frame is taken", async () => {
    const hook = setup();
    await startCamera(hook);

    hook.rerender({ sendFrame, options: { width: 150 }, showToast });
    tick();

    expect(sendFrame).toHaveBeenLastCalledWith("QUJD", { width: 150 });
  });

  it("draws the picture mirrored", async () => {
    const hook = setup();
    await startCamera(hook);
    tick();

    expect(camera.context.setTransform).toHaveBeenCalledWith(
      -1,
      0,
      0,
      1,
      480,
      0,
    );
    expect(camera.context.drawImage).toHaveBeenCalledWith(
      expect.anything(),
      0,
      0,
      480,
      360,
    );
  });

  it("shrinks big pictures to 480 wide, keeping the proportions", async () => {
    camera.video.width = 1920;
    camera.video.height = 1080;
    const hook = setup();
    await startCamera(hook);
    tick();

    expect(camera.context.drawImage).toHaveBeenCalledWith(
      expect.anything(),
      0,
      0,
      480,
      270,
    );
  });

  it("doesn't enlarge small pictures", async () => {
    camera.video.width = 320;
    camera.video.height = 240;
    const hook = setup();
    await startCamera(hook);
    tick();

    expect(camera.context.drawImage).toHaveBeenCalledWith(
      expect.anything(),
      0,
      0,
      320,
      240,
    );
  });

  it("waits until the camera shows pictures", async () => {
    camera.video.width = 0;
    const hook = setup();
    await startCamera(hook);

    tick(3);
    expect(sendFrame).not.toHaveBeenCalled();

    camera.video.width = 640;
    tick();
    expect(sendFrame).toHaveBeenCalledTimes(1);
  });

  it("keeps going when the sender drops a frame (backend busy)", async () => {
    sendFrame.mockReturnValue(false);
    const hook = setup();
    await startCamera(hook);

    tick(3);

    expect(sendFrame).toHaveBeenCalledTimes(3);
    expect(hook.result.current.active).toBe(true);
  });
});

describe("stopping", () => {
  it("releases the camera and stops capturing", async () => {
    const hook = setup();
    await startCamera(hook);
    tick();

    act(() => hook.result.current.stop());

    expect(camera.track.stop).toHaveBeenCalledTimes(1);
    expect(hook.result.current.active).toBe(false);
    tick(5);
    expect(sendFrame).toHaveBeenCalledTimes(1);
  });

  it("can be called when it isn't on", () => {
    const hook = setup();
    expect(() => act(() => hook.result.current.stop())).not.toThrow();
    expect(camera.track.stop).not.toHaveBeenCalled();
  });

  it("can be started again afterwards", async () => {
    const hook = setup();
    await startCamera(hook);
    act(() => hook.result.current.stop());

    await startCamera(hook);

    expect(camera.getUserMedia).toHaveBeenCalledTimes(2);
    expect(hook.result.current.active).toBe(true);
  });

  it("turns itself off when the camera is unplugged", async () => {
    const hook = setup();
    await startCamera(hook);

    act(() => camera.endTrack());

    expect(hook.result.current.active).toBe(false);
    expect(camera.track.stop).toHaveBeenCalled();
  });

  it("is released when the app closes the page", async () => {
    const hook = setup();
    await startCamera(hook);

    hook.unmount();

    expect(camera.track.stop).toHaveBeenCalled();
    tick(5);
    expect(sendFrame).not.toHaveBeenCalled();
  });
});

describe("cameraErrorMessage", () => {
  const named = (name, message = "boom") =>
    Object.assign(new Error(message), { name });

  it.each([
    ["NotAllowedError", "Camera access was refused"],
    ["SecurityError", "Camera access was refused"],
    ["NotFoundError", "No camera was found"],
    ["OverconstrainedError", "No camera was found"],
    ["NotReadableError", "The camera is being used by another program"],
    ["AbortError", "The camera is being used by another program"],
  ])("%s -> %s", (name, message) => {
    expect(cameraErrorMessage(named(name))).toBe(message);
  });

  it("falls back to the original message", () => {
    expect(cameraErrorMessage(named("WeirdError", "it broke"))).toBe(
      "The camera is not available: it broke",
    );
    expect(cameraErrorMessage("plain text")).toBe(
      "The camera is not available: plain text",
    );
  });
});
