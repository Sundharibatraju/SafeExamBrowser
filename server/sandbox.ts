import vm from 'vm';
import { spawn } from 'child_process';
import { CodingQuestion, CodeExecutionResponse, SingleTestResult } from '../src/types';

function normalizeOutput(val: any): string {
  if (val === undefined) return 'undefined';
  if (val === null) return 'null';
  if (typeof val === 'object') {
    try {
      return JSON.stringify(val);
    } catch {
      return String(val);
    }
  }
  return String(val).trim();
}

function compareResults(actual: any, expectedStr: string): boolean {
  const normActual = normalizeOutput(actual);
  const normExpected = expectedStr.trim();
  if (normActual === normExpected) return true;

  try {
    const parsedActual = typeof actual === 'string' ? JSON.parse(actual) : actual;
    const parsedExpected = JSON.parse(normExpected);
    return JSON.stringify(parsedActual) === JSON.stringify(parsedExpected);
  } catch {
    return normActual.replace(/\s+/g, '') === normExpected.replace(/\s+/g, '');
  }
}

export async function executeJavaScript(
  code: string,
  question: CodingQuestion
): Promise<CodeExecutionResponse> {
  const testResults: SingleTestResult[] = [];
  let passedCases = 0;
  let compilerOutput = '';

  for (const tc of question.testCases) {
    const startTime = Date.now();
    try {
      let parsedInput: any;
      try {
        parsedInput = JSON.parse(tc.input);
      } catch {
        parsedInput = tc.input;
      }

      const sandbox: Record<string, any> = {
        console: {
          log: (...args: any[]) => {
            if (compilerOutput.length < 2000) {
              compilerOutput += args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') + '\n';
            }
          },
          error: (...args: any[]) => {
            if (compilerOutput.length < 2000) {
              compilerOutput += '[ERR] ' + args.join(' ') + '\n';
            }
          }
        },
        Math,
        Array,
        Object,
        String,
        Number,
        Boolean,
        Map,
        Set,
        Date,
        parseInt,
        parseFloat,
        isNaN,
        isFinite
      };
      const context = vm.createContext(sandbox);

      let invocationCode = '';
      if (question.id === 'code-q1') {
        const numsStr = JSON.stringify(parsedInput.nums);
        const kVal = parsedInput.k;
        invocationCode = `\n; subarraySum(${numsStr}, ${kVal});`;
      } else if (question.id === 'code-q2') {
        const intervalsStr = JSON.stringify(parsedInput.intervals);
        invocationCode = `\n; mergeIntervals(${intervalsStr});`;
      } else {
        const argKeys = Object.keys(parsedInput);
        const argsStr = argKeys.map(k => JSON.stringify(parsedInput[k])).join(', ');
        invocationCode = `\n; (typeof solution === 'function' ? solution(${argsStr}) : null);`;
      }

      const script = new vm.Script(code + invocationCode);
      const actual = script.runInContext(context, { timeout: 2500 });
      const elapsed = Date.now() - startTime;
      const isPassed = compareResults(actual, tc.expectedOutput);
      if (isPassed) passedCases++;

      testResults.push({
        testCaseId: tc.id,
        input: tc.isHidden ? '[HIDDEN TEST CASE]' : tc.input,
        expectedOutput: tc.isHidden ? '[HIDDEN]' : tc.expectedOutput,
        actualOutput: tc.isHidden ? (isPassed ? '[MATCHED HIDDEN SPEC]' : '[MISMATCH]') : normalizeOutput(actual),
        passed: isPassed,
        isHidden: tc.isHidden,
        executionTimeMs: elapsed
      });
    } catch (err: any) {
      const elapsed = Date.now() - startTime;
      testResults.push({
        testCaseId: tc.id,
        input: tc.isHidden ? '[HIDDEN TEST CASE]' : tc.input,
        expectedOutput: tc.isHidden ? '[HIDDEN]' : tc.expectedOutput,
        actualOutput: 'ERROR',
        passed: false,
        isHidden: tc.isHidden,
        error: err?.message || 'Execution error',
        executionTimeMs: elapsed
      });
    }
  }

  const totalCases = question.testCases.length;
  const hiddenTestCases = question.testCases.filter(tc => tc.isHidden);
  const totalHiddenCases = hiddenTestCases.length;
  const passedHiddenCases = testResults.filter(r => r.isHidden && r.passed).length;
  const scoreAwarded = totalHiddenCases > 0
    ? Math.round((passedHiddenCases / totalHiddenCases) * question.marks)
    : Math.round((passedCases / totalCases) * question.marks);

  const status = passedCases === totalCases ? 'ACCEPTED' : (testResults.some(r => r.error) ? 'RUNTIME_ERROR' : 'WRONG_ANSWER');

  return {
    questionId: question.id,
    status,
    totalCases,
    passedCases,
    scoreAwarded,
    hiddenCasesTotal: totalHiddenCases,
    hiddenCasesPassed: passedHiddenCases,
    testResults,
    outputMessage: compilerOutput.trim() || (status === 'ACCEPTED' ? `All test cases passed (${passedHiddenCases}/${totalHiddenCases} hidden cases passed). ${scoreAwarded}/${question.marks} marks awarded.` : `${passedCases}/${totalCases} test cases passed. Hidden cases passed: ${passedHiddenCases}/${totalHiddenCases} (${scoreAwarded}/${question.marks} marks).`)
  };
}

export async function executePython(
  code: string,
  question: CodingQuestion
): Promise<CodeExecutionResponse> {
  const testResults: SingleTestResult[] = [];
  let passedCases = 0;
  let compilerOutput = '';

  for (const tc of question.testCases) {
    const startTime = Date.now();
    try {
      const parsedInput = JSON.parse(tc.input);
      let pythonDriver = '';
      if (question.id === 'code-q1') {
        pythonDriver = `
import json
${code}
nums = ${JSON.stringify(parsedInput.nums)}
k = ${parsedInput.k}
result = subarraySum(nums, k)
print("___TEST_OUTPUT_START___")
print(json.dumps(result))
print("___TEST_OUTPUT_END___")
`;
      } else if (question.id === 'code-q2') {
        pythonDriver = `
import json
${code}
intervals = ${JSON.stringify(parsedInput.intervals)}
result = mergeIntervals(intervals)
print("___TEST_OUTPUT_START___")
print(json.dumps(result))
print("___TEST_OUTPUT_END___")
`;
      }

      const res = await new Promise<{ stdout: string; stderr: string; timedOut: boolean }>((resolve) => {
        const proc = spawn('python3', ['-c', pythonDriver], {
          timeout: 3000
        });
        let stdout = '';
        let stderr = '';
        let timedOut = false;
        proc.stdout.on('data', (d) => { stdout += d.toString(); });
        proc.stderr.on('data', (d) => { stderr += d.toString(); });
        proc.on('close', (code) => {
          resolve({ stdout, stderr, timedOut });
        });
        proc.on('error', (err) => {
          resolve({ stdout, stderr: err.message, timedOut: false });
        });
      });

      const elapsed = Date.now() - startTime;
      if (res.stderr && compilerOutput.length < 1500) {
        compilerOutput += res.stderr + '\n';
      }

      if (res.timedOut) {
        testResults.push({
          testCaseId: tc.id,
          input: tc.isHidden ? '[HIDDEN]' : tc.input,
          expectedOutput: tc.isHidden ? '[HIDDEN]' : tc.expectedOutput,
          passed: false,
          isHidden: tc.isHidden,
          error: 'Time Limit Exceeded (3000ms)',
          executionTimeMs: elapsed
        });
        continue;
      }

      const match = res.stdout.match(/___TEST_OUTPUT_START___([\s\S]*?)___TEST_OUTPUT_END___/);
      if (!match) {
        testResults.push({
          testCaseId: tc.id,
          input: tc.isHidden ? '[HIDDEN]' : tc.input,
          expectedOutput: tc.isHidden ? '[HIDDEN]' : tc.expectedOutput,
          passed: false,
          isHidden: tc.isHidden,
          error: res.stderr || 'No return output detected',
          executionTimeMs: elapsed
        });
        continue;
      }

      const rawOutput = match[1].trim();
      let parsedOutput: any;
      try {
        parsedOutput = JSON.parse(rawOutput);
      } catch {
        parsedOutput = rawOutput;
      }

      const isPassed = compareResults(parsedOutput, tc.expectedOutput);
      if (isPassed) passedCases++;

      testResults.push({
        testCaseId: tc.id,
        input: tc.isHidden ? '[HIDDEN TEST CASE]' : tc.input,
        expectedOutput: tc.isHidden ? '[HIDDEN]' : tc.expectedOutput,
        actualOutput: tc.isHidden ? (isPassed ? '[MATCHED HIDDEN SPEC]' : '[MISMATCH]') : normalizeOutput(parsedOutput),
        passed: isPassed,
        isHidden: tc.isHidden,
        executionTimeMs: elapsed
      });
    } catch (err: any) {
      const elapsed = Date.now() - startTime;
      testResults.push({
        testCaseId: tc.id,
        input: tc.isHidden ? '[HIDDEN]' : tc.input,
        expectedOutput: tc.isHidden ? '[HIDDEN]' : tc.expectedOutput,
        passed: false,
        isHidden: tc.isHidden,
        error: err?.message || 'Python execution error',
        executionTimeMs: elapsed
      });
    }
  }

  const totalCases = question.testCases.length;
  const hiddenTestCases = question.testCases.filter(tc => tc.isHidden);
  const totalHiddenCases = hiddenTestCases.length;
  const passedHiddenCases = testResults.filter(r => r.isHidden && r.passed).length;
  const scoreAwarded = totalHiddenCases > 0
    ? Math.round((passedHiddenCases / totalHiddenCases) * question.marks)
    : Math.round((passedCases / totalCases) * question.marks);

  const status = passedCases === totalCases ? 'ACCEPTED' : (testResults.some(r => r.error) ? 'RUNTIME_ERROR' : 'WRONG_ANSWER');

  return {
    questionId: question.id,
    status,
    totalCases,
    passedCases,
    scoreAwarded,
    hiddenCasesTotal: totalHiddenCases,
    hiddenCasesPassed: passedHiddenCases,
    testResults,
    outputMessage: compilerOutput.trim() || (status === 'ACCEPTED' ? `All test cases passed in Python 3 (${passedHiddenCases}/${totalHiddenCases} hidden cases passed). ${scoreAwarded}/${question.marks} marks awarded.` : `${passedCases}/${totalCases} test cases passed. Hidden cases passed: ${passedHiddenCases}/${totalHiddenCases} (${scoreAwarded}/${question.marks} marks).`)
  };
}
