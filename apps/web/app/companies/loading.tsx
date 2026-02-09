export default function CompaniesLoading() {
  return (
    <main>
      <header className="pageHeader">
        <div className="skeletonLine" style={{ width: 120 }} />
        <div className="skeletonLine" style={{ width: 260, height: 26 }} />
      </header>
      <div className="cardsGrid">
        {Array.from({ length: 6 }).map((_, idx) => (
          <div key={idx} className="skeletonCard">
            <div className="skeletonLine" style={{ width: "60%", height: 16 }} />
            <div className="skeletonLine" style={{ width: "40%", marginTop: 8 }} />
          </div>
        ))}
      </div>
    </main>
  );
}
