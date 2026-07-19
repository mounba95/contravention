export default function Message({ texte, ok }) {
  if (!texte) return null;
  return <div className={`msg ${ok ? "ok" : "err"}`}>{texte}</div>;
}
