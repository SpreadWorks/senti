/**
 * WebappDataSource — common base for all webapp preset DataSources.
 *
 * Provides shared utilities used across webapp-type presets
 * (cakephp2, laravel, symfony).
 */

export default function register(container) {
  const DataSource = container.get("base.DataSource");
  const Scannable = container.get("base.Scannable");
  class WebappDataSource extends Scannable(DataSource) {}
  return WebappDataSource;
}
