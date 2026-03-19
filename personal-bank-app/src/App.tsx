function App() {
  return (
    <main className="app-shell">
      <section className="hero-card">
        <span className="eyebrow">Projet personnel</span>
        <h1>Application de gestion bancaire</h1>
        <p>
          Le dépôt est prêt pour accueillir ton code. Cette base isole la future application du site
          APAM déjà présent dans le repository.
        </p>

        <div className="status-grid">
          <article>
            <h2>État</h2>
            <p>Structure initialisée</p>
          </article>
          <article>
            <h2>Stack</h2>
            <p>React + TypeScript + Vite</p>
          </article>
          <article>
            <h2>Suite</h2>
            <p>Importer les écrans, composants et logique métier existants</p>
          </article>
        </div>
      </section>
    </main>
  );
}

export default App;
