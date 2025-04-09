/**
 * Format timestamp to display in a readable short format (HH:MM)
 */
export const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };
  
  /**
   * Format timestamp to display in a detailed format (Today at HH:MM:SS)
   */
  export const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    return `Today at ${date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })}`;
  };