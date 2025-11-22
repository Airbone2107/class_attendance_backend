// Project001/text-reporter.js
const fs = require('fs');

class MyTextReporter {
  constructor(globalConfig, reporterOptions) {
    this._globalConfig = globalConfig;
    this._options = reporterOptions;
  }

  onRunComplete(contexts, results) {
    let report = '';
    const EOL = require('os').EOL; // Ký tự xuống dòng tùy theo hệ điều hành

    report += `Test Run Complete${EOL}`;
    report += `Start Time: ${new Date(results.startTime)}${EOL}`;
    report += `Suites: ${results.numPassedTestSuites} passed, ${results.numFailedTestSuites} failed, ${results.numTotalTestSuites} total${EOL}`;
    report += `Tests:  ${results.numPassedTests} passed, ${results.numFailedTests} failed, ${results.numTotalTests} total${EOL}`;
    report += `=================================================================${EOL}${EOL}`;

    results.testResults.forEach(suiteResult => {
      const suiteStatus = suiteResult.numFailingTests > 0 ? 'FAIL' : 'PASS';
      report += `${suiteStatus} ${suiteResult.testFilePath.replace(process.cwd(), '')}${EOL}`;

      suiteResult.testResults.forEach(testResult => {
        report += `  ${testResult.status === 'passed' ? '✓' : '✗'} ${testResult.title} (${testResult.duration}ms)${EOL}`;
      });

      if (suiteResult.failureMessage) {
        // Xóa các mã màu ANSI khỏi thông báo lỗi cho dễ đọc
        const cleanFailureMessage = suiteResult.failureMessage.replace(
          /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, ''
        );
        report += `${EOL}  ● Failure Message:${EOL}`;
        report += `${cleanFailureMessage}${EOL}`;
      }
      report += EOL;
    });

    try {
      // Ghi file với mã hóa UTF-8 một cách tường minh
      fs.writeFileSync('test-report.txt', report, 'utf-8');
      console.log('Text report generated at: test-report.txt');
    } catch (e) {
      console.error('Failed to write text report:', e);
    }
  }
}

module.exports = MyTextReporter;