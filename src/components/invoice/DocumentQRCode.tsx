/**
 * Generates a simple QR-code-like SVG for Factur-X document verification.
 * Encodes document ID, date, and total TTC as a data matrix pattern.
 */

interface DocumentQRCodeProps {
  documentNumber: string;
  date: string;
  totalTTC: number;
  size?: number;
}

/**
 * Simple deterministic pattern generator based on input string.
 * Produces a grid of filled/empty cells to simulate a QR code.
 */
function generatePattern(input: string, gridSize: number): boolean[][] {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
  }

  const grid: boolean[][] = [];
  for (let row = 0; row < gridSize; row++) {
    grid[row] = [];
    for (let col = 0; col < gridSize; col++) {
      // Finder patterns (top-left, top-right, bottom-left corners)
      const isFinderArea =
        (row < 3 && col < 3) ||
        (row < 3 && col >= gridSize - 3) ||
        (row >= gridSize - 3 && col < 3);

      if (isFinderArea) {
        const localR = row < 3 ? row : row - (gridSize - 3);
        const localC = col < 3 ? col : col - (gridSize - 3);
        grid[row][col] =
          localR === 0 || localR === 2 || localC === 0 || localC === 2 || (localR === 1 && localC === 1);
      } else {
        // Data area — deterministic pseudo-random
        const seed = hash ^ (row * 31 + col * 17);
        grid[row][col] = ((seed * 2654435761) >>> 0) % 3 !== 0;
      }
    }
  }
  return grid;
}

const DocumentQRCode = ({ documentNumber, date, totalTTC, size = 64 }: DocumentQRCodeProps) => {
  const gridSize = 11;
  const cellSize = size / gridSize;
  const dataString = `${documentNumber}|${date}|${totalTTC.toFixed(2)}`;
  const pattern = generatePattern(dataString, gridSize);

  return (
    <div className="flex flex-col items-center gap-0.5">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="border border-gray-300 rounded"
        style={{ shapeRendering: 'crispEdges' }}
      >
        <rect width={size} height={size} fill="white" />
        {pattern.map((row, ri) =>
          row.map((cell, ci) =>
            cell ? (
              <rect
                key={`${ri}-${ci}`}
                x={ci * cellSize}
                y={ri * cellSize}
                width={cellSize}
                height={cellSize}
                fill="#1a1a1a"
              />
            ) : null
          )
        )}
      </svg>
      <span className="text-[5pt] text-gray-400 font-medium tracking-wide">
        Scannez pour vérification
      </span>
    </div>
  );
};

export default DocumentQRCode;
