import { useCallback, useEffect, useState } from "react";
import { ascart } from "../ascart";
import { isImageFile, isVideoFile } from "../lib/paths";

/**
 * The image the user picked (a preview to show, a path for the backend) and
 * dropping images anywhere in the window. Without the window-level handlers a
 * drop outside the preview box would make the window navigate to the file.
 */
export function useImageInput({ showToast }) {
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

  const loadImage = useCallback((/** @type {File} */ file) => {
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
    const handleDragOver = (e) => e.preventDefault();
    const handleDrop = (e) => {
      e.preventDefault();
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

    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("drop", handleDrop);
    return () => {
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("drop", handleDrop);
    };
  }, [loadImage, showToast]);

  return {
    imagePath,
    imagePreview,
    imageName,
    isVideo,
    loadImage,
    clearImage,
  };
}
