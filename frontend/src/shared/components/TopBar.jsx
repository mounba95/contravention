export default function TopBar({ tag, title, who, onLogout }) {
  return (
    <div className="topbar">
      <div className="brand"><span className="tag">{tag}</span> {title}</div>
      <div className="who">
        {who}
        {onLogout && <button className="logout" onClick={onLogout}>Déconnexion</button>}
      </div>
    </div>
  );
}
