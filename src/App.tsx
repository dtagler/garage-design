import { GuidedPlanner } from './components/planner';
import { BrowserSupportNotice } from './components/support';
import { AFFILIATION_DISCLAIMER, CATALOG_LATEST_CHECKED_DATE, PRICING_DISCLAIMER } from './data';
import './App.css';

export default function App() {
  return (
    <div className="app">
      <a className="app__skip-link" href="#planner-main">
        Skip to the planner
      </a>

      <header className="app__header">
        <img
          alt=""
          aria-hidden="true"
          className="app__brand-icon"
          height="88"
          src="/garagedesign-icon.svg"
          width="88"
        />
        <p className="app__eyebrow">Tile layout and cost planning</p>
        <h1>Garage Design</h1>
        <p className="app__tagline">
          One page: measure the garage and its doors, draw a rough design, compare drainable tiles,
          then read the exact count, cuts, packages, ramps, and cost.
        </p>
      </header>

      <BrowserSupportNotice />

      <main className="app__main" id="planner-main">
        <h2 className="visually-hidden" id="workspace-heading">
          Workspace
        </h2>
        <GuidedPlanner />
      </main>

      <footer className="app__footer">
        <p>{PRICING_DISCLAIMER}</p>
        <p>Seeded product prices were last checked on {CATALOG_LATEST_CHECKED_DATE}.</p>
        <p>{AFFILIATION_DISCLAIMER}</p>
      </footer>
    </div>
  );
}
