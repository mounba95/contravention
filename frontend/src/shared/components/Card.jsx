export default function Card({ title, children, style }) {
  return (
    <div className="card" style={style}>
      {title && <h2>{title}</h2>}
      {children}
    </div>
  );
}
