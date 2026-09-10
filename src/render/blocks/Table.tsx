import type { IRTable } from '../../core/ir'
import { Inline } from '../Inline'

/**
 * Wide tables scroll inside their own container — the page body must never
 * scroll horizontally, and in deck mode a table that overflows the panel would
 * otherwise push the whole slide sideways.
 */
export function TableBlock({ block }: { block: IRTable }) {
  return (
    <div className="table-scroll">
      <table className="md-table">
        <thead>
          <tr>
            {block.header.map((cell, index) => (
              <th key={index} style={{ textAlign: block.align[index] ?? undefined }}>
                <Inline nodes={cell.children} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} style={{ textAlign: block.align[cellIndex] ?? undefined }}>
                  <Inline nodes={cell.children} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
