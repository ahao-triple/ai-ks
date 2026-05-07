export interface ReadoutItem {
  label: string;
  value: string;
}

export interface ReadoutGridProps {
  items: ReadoutItem[];
}

export function ReadoutGrid({ items }: ReadoutGridProps) {
  return (
    <div className="readout-grid">
      {items.map((item) => (
        <div className="readout" key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  );
}
