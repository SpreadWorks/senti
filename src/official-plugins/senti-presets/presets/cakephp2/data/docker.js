/**
 * DockerSource — Docker configuration DataSource.
 *
 * CakePHP-only category: extends DataSource directly (no scan needed).
 */

export default function register(container) {
  const DataSource = container.get("base.DataSource");

  class CakephpDockerSource extends DataSource {
    list(analysis, labels) {
      return null;
    }
  }

  return CakephpDockerSource;
}
