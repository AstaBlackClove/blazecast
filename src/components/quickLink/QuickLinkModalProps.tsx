import { QuickLinkQueryExecutor } from "./quickLinkQueryExe";

interface QuickLinkModalProps {
  quickLinkData: {
    id: string;
    name: string;
    command: string;
  };
  onClose: () => void;
  onExecute: (finalCommand: string) => Promise<void>;
}

export function QuickLinkModal({
  quickLinkData,
  onClose,
  onExecute,
}: QuickLinkModalProps) {
  return (
    <QuickLinkQueryExecutor
      quickLinkId={quickLinkData.id}
      quickLinkName={quickLinkData.name}
      commandTemplate={quickLinkData.command}
      onClose={onClose}
      onExecute={onExecute}
    />
  );
}
