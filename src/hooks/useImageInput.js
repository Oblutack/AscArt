import { useCallback, useEffect, useState } from "react";
import { ascart } from "../ascart";

/**
 * The image the user picked (a preview to show, a path for the backend) and
 * dropping images anywhere in the window. Without the window-level handlers a
 * drop outside the preview box would make the window navigate to the file.
 */
export function useImageInput({ showToast }) {
  const [imagePath, setImagePath] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  const loadImage = useCallback((file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target.result);
      setImagePath(ascart.getPathForFile(file));
    };
    reader.readAsDataURL(file);
  }, []);

  const clearImage = useCallback(() => {
    setImagePath(null);
    setImagePreview(null);
  }, []);

  useEffect(() => {
    const handleDragOver = (e) => e.preventDefault();
    const handleDrop = (e) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer.files);
      if (files.length === 0) return;

      const image = files.find((file) => file.type.startsWith("image/"));
      if (image) {
        loadImage(image);
      } else {
        showToast("That file is not an image", "error");
      }
    };

    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("drop", handleDrop);
    return () => {
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("drop", handleDrop);
    };
  }, [loadImage, showToast]);

  return { imagePath, imagePreview, loadImage, clearImage };
}
