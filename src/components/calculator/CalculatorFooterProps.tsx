interface CalculatorFooterProps {
  showCopied: boolean;
}

export function CalculatorFooter({ showCopied }: CalculatorFooterProps) {
  return (
    <div className="flex-shrink-0 bg-gray-700 border-t border-gray-800 px-4 py-2 text-xs text-gray-400">
      <div className="flex justify-between items-center">
        <div>Calculator</div>
        <div className="flex space-x-3">
          <div className="flex items-center space-x-2">
            <span className="bg-gray-800 px-2 py-1 rounded">↵</span>
            <span>{showCopied ? "Copied!" : "Copy Result"}</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="bg-gray-800 px-2 py-1 rounded">ESC</span>
            <span>Close</span>
          </div>
        </div>
      </div>
    </div>
  );
}
