/**
 * CommandsSource — Laravel Artisan commands DataSource.
 *
 * Extends webapp CommandsSource with Laravel-specific match logic.
 * Scan/resolve are delegated to the parent class.
 */

export default function register(container) {
  const hasPathPrefix = container.get("pathMatch.hasPathPrefix");
  const webapp = container.getPreset("webapp").dataSources;
  const CommandsSource = webapp.commands;
  const CommandEntry = CommandsSource.Entry;

  class LaravelCommandsSource extends CommandsSource {
    static Entry = CommandEntry;

    match(relPath) {
      return hasPathPrefix(relPath, "app/Console/Commands/")
        && relPath.endsWith(".php");
    }
  }

  return LaravelCommandsSource;
}
