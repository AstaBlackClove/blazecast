import { invoke } from "@tauri-apps/api/tauri";
import { useEffect, useState, memo } from "react";

// Using memo to prevent unnecessary re-renders
export const ClipboardImage = memo(({ filePath }: { filePath: string }) => {
  const [blobUrl, setBlobUrl] = useState<any>(null);
  const [error, setError] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    const loadImage = async () => {
      try {
        // Set loading state
        setLoading(true);

        // Call Rust command to get bytes
        const result = await invoke<number[]>("load_clipboard_image_bytes", {
          filePath,
        });

        // Check if component is still mounted
        if (!isMounted) return;

        // Convert number array to Uint8Array
        const arrayBuffer = new Uint8Array(result);

        // Turn Uint8Array into a Blob with optimized settings
        const blob = new Blob([arrayBuffer], {
          type: "image/png",
        });

        // Create a blob URL
        const url = URL.createObjectURL(blob);
        setBlobUrl(url);
      } catch (error) {
        if (isMounted) {
          console.error("Failed to load image:", error);
          setError(true);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadImage();

    // Cleanup: revoke the blob URL when component unmounts
    return () => {
      isMounted = false;
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [filePath]);

  if (error) {
    return <div className="text-red-400">Failed to load image</div>;
  }

  if (loading) {
    return <div className="flex justify-center p-4">Loading image...</div>;
  }

  return (
    <div className="flex justify-center">
      <img
        src={blobUrl}
        alt="Clipboard Image"
        className="max-h-48 max-w-full object-contain"
        onError={() => setError(true)}
        loading="lazy"
      />
    </div>
  );
});
