export default function DashboardLoading() {
  return (
    <main>
      <header className="pageHeader">
        <div className="skeletonLine" style={{ width: 130 }} />
        <div className="skeletonLine" style={{ width: 240, height: 28 }} />
      </header>
      <div className="cardsGrid">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className="skeletonCard">
            <div className="skeletonLine" style={{ width: "65%", height: 16 }} />
            <div className="skeletonLine" style={{ width: "45%", marginTop: 10 }} />
          </div>
        ))}
      </div>
    </main>
  );
}
