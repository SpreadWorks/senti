/**
 * TestsSource — CakePHP 2.x test structure DataSource.
 */

export default function register(container) {
  const AnalysisEntry = container.get("base.AnalysisEntry");
  const hasPathPrefix = container.get("pathMatch.hasPathPrefix");
  const WebappDataSource = container.getPreset("webapp").dataSources["webapp-data-source"];

  class TestEntry extends AnalysisEntry {
    testType = null;
    static summary = {};
  }

  class CakephpTestsSource extends WebappDataSource {
    static Entry = TestEntry;

    match(relPath) {
      return hasPathPrefix(relPath, "app/Test/");
    }

    parse(absPath) {
      const entry = new TestEntry();

      if (/\/Test\/Case\/Controller\//.test(absPath) && absPath.endsWith("Test.php")) {
        entry.testType = "controllerTest";
      } else if (/\/Test\/Case\/Model\//.test(absPath) && absPath.endsWith("Test.php")) {
        entry.testType = "modelTest";
      } else if (/\/Test\/Fixture\//.test(absPath) && absPath.endsWith("Fixture.php")) {
        entry.testType = "fixture";
      }

      return entry;
    }

    list(analysis, labels) {
      const entries = analysis.tests?.entries || [];
      if (entries.length === 0) return null;

      const controllerTests = entries.filter((e) => e.testType === "controllerTest").length;
      const modelTests = entries.filter((e) => e.testType === "modelTest").length;
      const fixtures = entries.filter((e) => e.testType === "fixture").length;

      const rows = [
        ["コントローラテスト", controllerTests, "app/Test/Case/Controller/"],
        ["モデルテスト", modelTests, "app/Test/Case/Model/"],
        ["フィクスチャ", fixtures, "app/Test/Fixture/"],
      ];
      return this.toMarkdownTable(rows, labels);
    }
  }

  return CakephpTestsSource;
}
