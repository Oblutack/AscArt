import { useCallback, useEffect, useRef, useState } from "react";
import { ascart } from "../ascart";
import { isImageFile, isVideoFile } from "../lib/paths";

/**
 * The image the user picked (a preview to show, a path for the backend) and
 * dropping images anywhere in the window. Without the window-level handlers a
 * drop outside the preview box would make the window navigate to the file.
 * `isDragging` is true while files are dragged over the window.
 */
export function useImageInput({ showToast, onLoad }) {
  const [imagePath, setImagePath] = useState(
    /** @type {string | null} */ (null),
  );
  const [imagePreview, setImagePreview] = useState(
    /** @type {string | null} */ (null),
  );
  const [imageName, setImageName] = useState(
    /** @type {string | null} */ (null),
  );
  const [isVideo, setIsVideo] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Told whenever a file is picked or dropped (the app turns the camera off)
  const onLoadRef = useRef(onLoad);
  useEffect(() => {
    onLoadRef.current = onLoad;
  });

  const loadImage = useCallback((/** @type {File} */ file) => {
    onLoadRef.current?.();
    setImageName(file.name);

    if (isVideoFile(file)) {
      // A video can't be shown in an <img>, and reading it all just to
      // preview it would be wasteful: the backend reads it from its path
      setIsVideo(true);
      setImagePreview(null);
      setImagePath(ascart.getPathForFile(file));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setIsVideo(false);
      setImagePreview(/** @type {string} */ (reader.result));
      setImagePath(ascart.getPathForFile(file));
    };
    reader.readAsDataURL(file);
  }, []);

  const clearImage = useCallback(() => {
    setImagePath(null);
    setImagePreview(null);
    setImageName(null);
    setIsVideo(false);
  }, []);

  useEffect(() => {
    // dragenter and dragleave fire for every element the pointer crosses, so
    // count them: the drag has left the window when the count is back to 0
    let depth = 0;
    const carriesFiles = (e) =>
      Array.from(e.dataTransfer?.types ?? []).includes("Files");

    const handleDragEnter = (e) => {
      if (!carriesFiles(e)) return;
      depth += 1;
      setIsDragging(true);
    };
    const handleDragLeave = (e) => {
      if (!carriesFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setIsDragging(false);
    };
    const handleDragOver = (e) => e.preventDefault();
    const handleDrop = (e) => {
      e.preventDefault();
      depth = 0;
      setIsDragging(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length === 0) return;

      const usable = files.find(
        (file) => isImageFile(file) || isVideoFile(file),
      );
      if (usable) {
        loadImage(usable);
      } else {
        showToast("That file is not an image, GIF or video", "error");
      }
    };

    window.addEventListener("dragenter", handleDragEnter);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("drop", handleDrop);
    return () => {
      window.removeEventListener("dragenter", handleDragEnter);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("drop", handleDrop);
    };
  }, [loadImage, showToast]);

  return {
    imagePath,
    imagePreview,
    imageName,
    isVideo,
    isDragging,
    loadImage,
    clearImage,
  };
}
