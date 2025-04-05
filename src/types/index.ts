export interface Suggestion {
  id: string;
  title: string;
  subtitle?: string;
  icon?: string;
  iconColor?: string;
  category?: string;
  action: () => void;
}
