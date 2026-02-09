export default function ChangeEventLoading() {
  return (
    <main>
      <header className="pageHeader">
        <div className="skeletonLine" style={{ width: 160 }} />
        <div className="skeletonLine" style={{ width: 320, height: 30 }} />
      </header>
      <div className="stack">
        <div className="skeletonCard">
          <div className="skeletonLine" style={{ width: "26%", height: 16 }} />
          <div className="skeletonLine" style={{ width: "100%", marginTop: 10 }} />
          <div className="skeletonLine" style={{ width: "92%", marginTop: 10 }} />
        </div>
        <div className="skeletonCard">
          <div className="skeletonLine" style={{ width: "18%", height: 16 }} />
          <div className="skeletonLine" style={{ width: "100%", marginTop: 10 }} />
          <div className="skeletonLine" style={{ width: "100%", marginTop: 10 }} />
          <div className="skeletonLine" style={{ width: "100%", marginTop: 10 }} />
        </div>
      </div>
    </main>
  );
}
