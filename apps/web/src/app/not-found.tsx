export default function NotFound() {
  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      flexDirection: 'column',
      gap: '1rem',
      padding: '1rem'
    }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 'bold' }}>404 - Page Not Found</h1>
      <p>The page you're looking for doesn't exist.</p>
      <a href="/" style={{ color: '#3b82f6', textDecoration: 'underline' }}>
        Go to Homepage
      </a>
    </div>
  )
}