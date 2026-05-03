export default function CakeDisplay({ count, label }) {
  const cakes = Array.from({ length: Math.max(0, count) })
  return (
    <div className="cake-display">
      <span className="cake-label">{label}</span>
      <div className="cake-row">
        {cakes.map((_, i) => (
          <span key={i} className="cake-token" title={`Cake ${i + 1}`}>
            🍰
          </span>
        ))}
        {count <= 0 && <span className="no-cakes">No cakes</span>}
      </div>
    </div>
  )
}
