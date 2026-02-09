export default function CompanyLoading() {
  return (
    <main>
      <header className="pageHeader">
        <div className="skeletonLine" style={{ width: 140 }} />
        <div className="skeletonLine" style={{ width: 320, height: 30 }} />
      </header>
      <div className="stack">
        {Array.from({ length: 3 }).map((_, idx) => (
          <div key={idx} className="skeletonCard">
            <div className="skeletonLine" style={{ width: "30%", height: 16 }} />
            <div className="skeletonLine" style={{ width: "80%", marginTop: 10 }} />
            <div className="skeletonLine" style={{ width: "55%", marginTop: 10 }} />
          </div>
        ))}
      </div>
    </main>
  );
}
