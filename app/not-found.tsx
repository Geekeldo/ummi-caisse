export default function NotFound() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 48, fontWeight: 700, margin: 0, color: '#2D8B75' }}>404</p>
        <p style={{ color: '#9CA3AF', marginTop: 8 }}>Page introuvable</p>
        <a href="/dashboard" style={{ display: 'inline-block', marginTop: 16, color: '#2D8B75', fontSize: 14 }}>
          Retour au tableau de bord
        </a>
      </div>
    </div>
  )
}
