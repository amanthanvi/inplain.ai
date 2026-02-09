export default function SettingsLoading() {
  return (
    <main>
      <header className="pageHeader">
        <div className="skeletonLine" style={{ width: 110 }} />
        <div className="skeletonLine" style={{ width: 200, height: 28 }} />
      </header>
      <div className="cardsGrid">
        {Array.from({ length: 6 }).map((_, idx) => (
          <div key={idx} className="skeletonCard">
            <div className="skeletonLine" style={{ width: "50%" }} />
            <div className="skeletonLine" style={{ width: "70%", height: 22, marginTop: 10 }} />
          </div>
        ))}
      </div>
    </main>
  );
}
