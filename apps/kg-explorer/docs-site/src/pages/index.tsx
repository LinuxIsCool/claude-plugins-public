import React from "react";
import clsx from "clsx";
import Link from "@docusaurus/Link";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Layout from "@theme/Layout";
import styles from "./index.module.css";

function HomepageHeader() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <header className={clsx("hero", styles.heroBanner)}>
      <div className="container">
        <h1 className="hero__title">{siteConfig.title}</h1>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <div className={styles.buttons}>
          <Link
            className="button button--primary button--lg"
            to="/docs/getting-started/installation"
          >
            Get Started
          </Link>
          <Link
            className="button button--secondary button--lg"
            to="/docs/concepts/knowledge-graphs"
          >
            Learn Concepts
          </Link>
        </div>
      </div>
    </header>
  );
}

interface FeatureItem {
  title: string;
  description: string;
  link: string;
}

const FeatureList: FeatureItem[] = [
  {
    title: "Knowledge Graph Exploration",
    description:
      "Navigate interconnected knowledge with powerful graph traversal. Query speakers, concepts, beliefs, and their relationships through an intuitive interface.",
    link: "/docs/concepts/knowledge-graphs",
  },
  {
    title: "Temporal Intelligence",
    description:
      "Track how knowledge evolves over time. Bi-temporal modeling captures when facts were true and when they were recorded, enabling historical queries.",
    link: "/docs/concepts/ontology-design",
  },
  {
    title: "Recursive Improvement",
    description:
      "The system improves itself through continuous observation, analysis, and iteration. Watch the knowledge graph grow smarter with each cycle.",
    link: "/docs/concepts/recursive-improvement",
  },
  {
    title: "Powerful Queries",
    description:
      "Write Cypher, GraphQL, or natural language queries. The system translates your intent into optimized graph traversals.",
    link: "/docs/guides/writing-queries",
  },
  {
    title: "Automated Insights",
    description:
      "Discover patterns, gaps, and trends automatically. AI agents continuously analyze the graph and surface actionable insights.",
    link: "/docs/guides/interpreting-insights",
  },
  {
    title: "Extensible Architecture",
    description:
      "Built for growth. Add new node types, edge types, and extraction rules as your knowledge domain evolves.",
    link: "/docs/architecture/system-overview",
  },
];

function Feature({ title, description, link }: FeatureItem) {
  return (
    <div className={clsx("col col--4")}>
      <div className={styles.featureCard}>
        <h3>{title}</h3>
        <p>{description}</p>
        <Link to={link} className={styles.featureLink}>
          Learn more →
        </Link>
      </div>
    </div>
  );
}

function HomepageFeatures(): JSX.Element {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}

function HomepageStats(): JSX.Element {
  return (
    <section className={styles.stats}>
      <div className="container">
        <div className={styles.statsGrid}>
          <div className={styles.statItem}>
            <div className={styles.statValue}>8</div>
            <div className={styles.statLabel}>Node Types</div>
          </div>
          <div className={styles.statItem}>
            <div className={styles.statValue}>11</div>
            <div className={styles.statLabel}>Edge Types</div>
          </div>
          <div className={styles.statItem}>
            <div className={styles.statValue}>Bi-temporal</div>
            <div className={styles.statLabel}>Time Tracking</div>
          </div>
          <div className={styles.statItem}>
            <div className={styles.statValue}>Recursive</div>
            <div className={styles.statLabel}>Self-Improvement</div>
          </div>
        </div>
      </div>
    </section>
  );
}

function HomepageQuickStart(): JSX.Element {
  return (
    <section className={styles.quickstart}>
      <div className="container">
        <h2>Quick Start</h2>
        <div className={styles.codeBlock}>
          <pre>
            <code>
              {`# Clone and install
git clone https://github.com/your-org/kg-explorer.git
cd kg-explorer

# Start infrastructure
docker compose up -d

# Run the application
npm run dev`}
            </code>
          </pre>
        </div>
        <Link
          className="button button--primary"
          to="/docs/getting-started/installation"
        >
          Full Installation Guide
        </Link>
      </div>
    </section>
  );
}

export default function Home(): JSX.Element {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout
      title={siteConfig.title}
      description="Knowledge Graph Exploration for Recursive Intelligence"
    >
      <HomepageHeader />
      <main>
        <HomepageFeatures />
        <HomepageStats />
        <HomepageQuickStart />
      </main>
    </Layout>
  );
}
