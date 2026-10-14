import { spawn, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import esbuild from 'esbuild';
import { CodingQuestion, CodeExecutionResponse, SingleTestResult, TestCase } from '../src/types';

export type SupportedLanguage = 'c' | 'cpp' | 'java' | 'python' | 'typescript' | 'javascript';

export interface CompilerResult {
  status: 'ACCEPTED' | 'WRONG_ANSWER' | 'RUNTIME_ERROR' | 'COMPILE_ERROR' | 'TIME_LIMIT_EXCEEDED';
  stdout: string;
  stderr: string;
  compilerError?: string;
  executionTimeMs: number;
  exitCode: number | null;
}

const availableBinariesCache = new Map<string, string>();

function resolveExecutable(candidates: string[]): string | null {
  for (const cmd of candidates) {
    if (availableBinariesCache.has(cmd)) {
      return availableBinariesCache.get(cmd)!;
    }
    for (const prefix of ['/usr/bin/', '/usr/local/bin/', '/bin/', '/usr/lib/jvm/java-17-openjdk-amd64/bin/']) {
      const fullPath = prefix + cmd;
      if (fs.existsSync(fullPath)) {
        availableBinariesCache.set(cmd, fullPath);
        return fullPath;
      }
    }
    try {
      const checkTool = process.platform === 'win32' ? 'where' : 'which';
      const res = spawnSync(checkTool, [cmd], { stdio: 'pipe' });
      if (res.status === 0) {
        const foundPath = res.stdout.toString().trim().split('\n')[0].trim();
        const finalCmd = foundPath || cmd;
        availableBinariesCache.set(cmd, finalCmd);
        return finalCmd;
      }
    } catch {
      // not found
    }
  }
  return null;
}

export function getNativeCompilerCommand(language: SupportedLanguage): string | null {
  switch (language) {
    case 'python':
      return resolveExecutable(['python3', 'python', 'py']);
    case 'c':
      return resolveExecutable(['gcc', 'clang']);
    case 'cpp':
      return resolveExecutable(['g++', 'clang++']);
    case 'java':
      return resolveExecutable(['javac']);
    case 'javascript':
    case 'typescript':
      return process.execPath;
    default:
      return null;
  }
}

let toolchainInstallPromise: Promise<boolean> | null = null;

export async function ensureNativeToolchain(language: SupportedLanguage): Promise<boolean> {
  if (language === 'python' || language === 'javascript' || language === 'typescript') {
    return true;
  }
  let existing = getNativeCompilerCommand(language);
  if (existing) {
    return true;
  }
  if (toolchainInstallPromise) {
    await toolchainInstallPromise;
    availableBinariesCache.clear();
    return !!getNativeCompilerCommand(language);
  }
  toolchainInstallPromise = new Promise<boolean>((resolve) => {
    console.log(`[Compiler Engine] Toolchain for '${language}' missing on system. Auto-installing OpenJDK & GCC...`);
    const proc = spawn('sh', [
      '-c',
      'DEBIAN_FRONTEND=noninteractive apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends -o Dpkg::Options::="--force-confold" -o Dpkg::Options::="--force-confdef" openjdk-17-jdk-headless gcc g++'
    ], { stdio: 'inherit' });
    proc.on('close', (code) => {
      availableBinariesCache.clear();
      console.log(`[Compiler Engine] Toolchain auto-installation finished with exit code ${code}.`);
      resolve(code === 0);
    });
    proc.on('error', (err) => {
      console.error(`[Compiler Engine] Toolchain auto-installation spawn error:`, err);
      resolve(false);
    });
  });
  const ok = await toolchainInstallPromise;
  toolchainInstallPromise = null;
  availableBinariesCache.clear();
  return !!getNativeCompilerCommand(language);
}

function runProcess(
  cmd: string,
  args: string[],
  cwd: string,
  inputStdin: string = '',
  timeoutMs: number = 6000
): Promise<{ stdout: string; stderr: string; exitCode: number | null; timedOut: boolean; executionTimeMs: number; binaryMissing?: boolean }> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const env = {
      ...process.env,
      PATH: `/usr/lib/jvm/java-17-openjdk-amd64/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:${process.env.PATH || ''}`
    };
    let proc: any;
    try {
      proc = spawn(cmd, args, { cwd, env });
    } catch (err: any) {
      const isMissing = err.code === 'ENOENT' || err.message?.includes('ENOENT');
      return resolve({
        stdout: '',
        stderr: err.message,
        exitCode: 1,
        timedOut: false,
        executionTimeMs: Date.now() - startTime,
        binaryMissing: isMissing
      });
    }
    const timer = setTimeout(() => {
      timedOut = true;
      try { proc.kill('SIGKILL'); } catch {}
    }, timeoutMs);

    proc.stdin?.on('error', () => {});
    if (inputStdin) {
      try {
        proc.stdin.write(inputStdin);
        proc.stdin.end();
      } catch {}
    } else {
      try { proc.stdin.end(); } catch {}
    }

    proc.stdout?.on('data', (data: any) => {
      if (stdout.length < 50000) stdout += data.toString();
    });
    proc.stderr?.on('data', (data: any) => {
      if (stderr.length < 50000) stderr += data.toString();
    });

    proc.on('close', (exitCode: number | null, signal: NodeJS.Signals | null) => {
      clearTimeout(timer);
      const executionTimeMs = Date.now() - startTime;
      let finalStderr = stderr.trim();
      if (signal) {
        let signalDesc = String(signal);
        if (signal === 'SIGFPE') signalDesc = 'SIGFPE (Floating Point Exception: Division by zero or arithmetic overflow)';
        else if (signal === 'SIGSEGV') signalDesc = 'SIGSEGV (Segmentation Fault: Invalid memory address, out-of-bounds array access, or null pointer dereference)';
        else if (signal === 'SIGABRT') signalDesc = 'SIGABRT (Aborted: Assertion failure or double free)';
        else if (signal === 'SIGILL') signalDesc = 'SIGILL (Illegal instruction)';
        finalStderr = finalStderr ? `${finalStderr}\nRuntime error: Terminated by ${signalDesc}` : `Runtime error: Terminated by ${signalDesc}`;
      }
      resolve({
        stdout: stdout.trim(),
        stderr: finalStderr,
        exitCode: exitCode !== null ? exitCode : (signal ? 139 : 1),
        timedOut,
        executionTimeMs
      });
    });

    proc.on('error', (err: any) => {
      clearTimeout(timer);
      const executionTimeMs = Date.now() - startTime;
      const isMissing = err.code === 'ENOENT' || err.message?.includes('ENOENT');
      resolve({
        stdout,
        stderr: stderr + '\n' + err.message,
        exitCode: 1,
        timedOut: false,
        executionTimeMs,
        binaryMissing: isMissing
      });
    });
  });
}

function sanitizeCompilerOutput(output: string, tempDir: string): string {
  if (!output) return '';
  const escapedDir = tempDir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return output.replace(new RegExp(escapedDir + '[/\\\\]?', 'g'), '').trim();
}

export function prepareSourceCode(
  code: string,
  language: SupportedLanguage
): { preparedCode: string; primaryName: string } {
  let clean = code.trim();
  switch (language) {
    case 'java': {
      const publicClassMatch = clean.match(/public\s+class\s+([A-Za-z0-9_]+)/);
      const anyClassMatch = clean.match(/class\s+([A-Za-z0-9_]+)/);
      const className = publicClassMatch ? publicClassMatch[1] : (anyClassMatch ? anyClassMatch[1] : 'Solution');
      const hasMain = /public\s+static\s+void\s+main\s*\(\s*String/i.test(clean);

      if ((publicClassMatch || anyClassMatch) && hasMain) {
        let finalCode = clean.replace(/^\s*package\s+[a-zA-Z0-9_.]+;/gm, '// package stripped');
        if (!finalCode.includes('import java.util') && (finalCode.includes('Scanner') || finalCode.includes('List') || finalCode.includes('Arrays'))) {
          finalCode = 'import java.util.*;\n' + finalCode;
        }
        return { preparedCode: finalCode, primaryName: className };
      }

      if (!publicClassMatch && !anyClassMatch) {
        const prepared = `import java.util.*;\nimport java.io.*;\n\npublic class Solution {\n    public static void main(String[] args) {\n        ${clean}\n    }\n}`;
        return { preparedCode: prepared, primaryName: 'Solution' };
      }

      let raw = clean.replace(/^\s*package\s+[a-zA-Z0-9_.]+;/gm, '// package stripped');
      let classBody = raw;
      if (!classBody.includes(`public class ${className}`)) {
        classBody = classBody.replace(new RegExp(`class\\s+${className}`), `public class ${className}`);
      }
      const lastBraceIdx = classBody.lastIndexOf('}');
      if (lastBraceIdx !== -1) {
        const mainHarness = `
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        ${className} sol = new ${className}();
        try {
            java.lang.reflect.Method[] methods = ${className}.class.getDeclaredMethods();
            java.lang.reflect.Method target = null;
            for (java.lang.reflect.Method m : methods) {
                if (!m.getName().equals("main")) { target = m; break; }
            }
            if (target != null) {
                target.setAccessible(true);
                Class<?>[] pTypes = target.getParameterTypes();
                Object[] argsList = new Object[pTypes.length];
                for (int i = 0; i < pTypes.length; i++) {
                    if (pTypes[i] == String.class) {
                        argsList[i] = sc.hasNextLine() ? sc.nextLine().trim() : (sc.hasNext() ? sc.next().trim() : "");
                    } else if (pTypes[i] == int.class || pTypes[i] == Integer.class) {
                        argsList[i] = sc.hasNextInt() ? sc.nextInt() : 0;
                    } else if (pTypes[i] == int[].class) {
                        List<Integer> list = new ArrayList<>();
                        while (sc.hasNextInt()) list.add(sc.nextInt());
                        int[] arr = new int[list.size()];
                        for (int j = 0; j < arr.length; j++) arr[j] = list.get(j);
                        argsList[i] = arr;
                    }
                }
                Object res = target.invoke(sol, argsList);
                if (res != null) {
                    if (res instanceof int[]) {
                        System.out.println(Arrays.toString((int[]) res));
                    } else {
                        System.out.println(res);
                    }
                }
            }
        } catch (Exception e) {}
    }
`;
        classBody = classBody.slice(0, lastBraceIdx) + mainHarness + classBody.slice(lastBraceIdx);
      }
      const defaultImports = 'import java.util.*;\nimport java.io.*;\n';
      const prepared = clean.includes('import java.util') ? classBody.trim() : `${defaultImports}\n${classBody.trim()}`;
      return { preparedCode: prepared, primaryName: className };
    }
    case 'python': {
      const hasDef = /def\s+([A-Za-z0-9_]+)\s*\(/.test(clean);
      const hasPrint = /print\s*\(/.test(clean);
      const hasMain = /if\s+__name__\s*==/.test(clean);
      if (hasDef && !hasPrint && !hasMain) {
        const funcMatch = clean.match(/def\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)/);
        const funcName = funcMatch ? funcMatch[1] : '';
        if (funcName) {
          clean += `\n
if __name__ == '__main__':
    import sys, json
    _raw = sys.stdin.read()
    if _raw.endswith('\\r\\n'):
        _raw = _raw[:-2]
    elif _raw.endswith('\\n'):
        _raw = _raw[:-1]
    _trimmed = _raw.strip()
    _args = []
    if not _trimmed:
        _args = ['']
    else:
        try:
            _parsed = json.loads('[' + _trimmed + ']')
            if isinstance(_parsed, list):
                _args = _parsed
            else:
                _args = [_parsed]
        except Exception:
            try:
                _single = json.loads(_trimmed)
                _args = [_single]
            except Exception:
                _lines = [l.strip() for l in _trimmed.splitlines() if l.strip()]
                if len(_lines) >= 2:
                    try:
                        _p1 = [int(x) for x in _lines[0].split() if x]
                        _p2 = int(_lines[1])
                        _args = [_p1, _p2]
                    except Exception:
                        _args = [_lines[0], _lines[1]]
                else:
                    _args = [_trimmed]
    try:
        _res = ${funcName}(*_args)
        if _res is not None:
            if isinstance(_res, (list, dict)):
                print(json.dumps(_res))
            else:
                print(_res)
    except Exception as _e:
        import traceback
        traceback.print_exc()
        sys.exit(1)
`;
        }
      }
      return { preparedCode: clean, primaryName: 'solution' };
    }
    case 'javascript':
    case 'typescript': {
      const hasFunc = /function\s+([A-Za-z0-9_]+)\s*\(|const\s+([A-Za-z0-9_]+)\s*=\s*(?:function|\([^)]*\)\s*=>)/.test(clean);
      const hasLog = /console\.log/.test(clean);
      if (hasFunc && !hasLog) {
        const funcMatch = clean.match(/function\s+([A-Za-z0-9_]+)\s*\(|const\s+([A-Za-z0-9_]+)\s*=\s*(?:function|\([^)]*\)\s*=>)/);
        const funcName = funcMatch ? (funcMatch[1] || funcMatch[2]) : 'solution';
        clean += `\n
const _fs = require('fs');
let _rawInput = _fs.readFileSync(0, 'utf-8');
if (_rawInput.endsWith('\\r\\n')) _rawInput = _rawInput.slice(0, -2);
else if (_rawInput.endsWith('\\n')) _rawInput = _rawInput.slice(0, -1);
if (typeof ${funcName} === 'function') {
  let _args = [];
  const _trimmed = _rawInput.trim();
  if (_trimmed === '') {
    _args = [''];
  } else {
    try {
      const wrapped = JSON.parse('[' + _trimmed + ']');
      if (Array.isArray(wrapped)) _args = wrapped;
    } catch (e1) {
      try {
        const single = JSON.parse(_trimmed);
        _args = [single];
      } catch (e2) {
        const _lines = _trimmed.split('\\n').filter(Boolean);
        if (_lines.length >= 2 && ${funcName}.length === 2) {
          const _p1 = _lines[0].trim().split(' ').filter(Boolean).map(x => isNaN(Number(x)) ? x : Number(x));
          const _p2 = isNaN(Number(_lines[1])) ? _lines[1] : Number(_lines[1]);
          _args = [_p1, _p2];
        } else {
          _args = [_trimmed];
        }
      }
    }
  }
  try {
    const _res = ${funcName}(..._args);
    if (_res !== undefined) {
      console.log(typeof _res === 'object' && _res !== null ? JSON.stringify(_res) : _res);
    }
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
`;
      }
      return { preparedCode: clean, primaryName: 'solution' };
    }
    case 'cpp': {
      if (!clean.includes('#include <iostream>')) {
        clean = '#include <iostream>\n#include <vector>\n#include <string>\n#include <algorithm>\n#include <sstream>\nusing namespace std;\n' + clean;
      }
      const hasMain = /\b(?:int|void)\s+main\s*\(/.test(clean);
      if (!hasMain) {
        const fnMatch = clean.match(/(?:string|int|long long|double|bool|vector\s*<[^>]+>|void)\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)/);
        if (fnMatch && fnMatch[1] !== 'main') {
          const fnName = fnMatch[1];
          const fnParams = fnMatch[2];
          if (fnParams.includes('string')) {
            clean += `\n
int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    string s;
    if (cin >> s) {
        cout << ${fnName}(s) << "\\n";
    }
    return 0;
}
`;
          } else if (fnParams.includes('vector')) {
            clean += `\n
int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    int val;
    vector<int> nums;
    while (cin >> val) nums.push_back(val);
    if (!nums.empty()) {
        cout << ${fnName}(nums) << "\\n";
    }
    return 0;
}
`;
          } else {
            clean += `\n
int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    string s;
    if (getline(cin, s)) {
        if (!s.empty()) cout << ${fnName}(s) << "\\n";
    }
    return 0;
}
`;
          }
        }
      }
      return { preparedCode: clean, primaryName: 'main' };
    }
    case 'c': {
      if (!clean.includes('#include <stdio.h>')) {
        clean = '#include <stdio.h>\n#include <string.h>\n#include <stdlib.h>\n' + clean;
      }
      const hasMain = /\b(?:int|void)\s+main\s*\(/.test(clean);
      if (!hasMain) {
        const fnMatch = clean.match(/(?:char\s*\*|int|long|void)\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)/);
        if (fnMatch && fnMatch[1] !== 'main') {
          const fnName = fnMatch[1];
          clean += `\n
int main() {
    char buf[4096];
    if (scanf("%4095s", buf) == 1) {
        char* res = ${fnName}(buf);
        if (res) printf("%s\\n", res);
    }
    return 0;
}
`;
        }
      }
      return { preparedCode: clean, primaryName: 'main' };
    }
    default:
      return { preparedCode: clean, primaryName: 'solution' };
  }
}

export function formatStdinForTestCase(
  rawInput: string,
  userCode: string = '',
  language: SupportedLanguage = 'java'
): string {
  if (rawInput === undefined || rawInput === null) return '\n';
  let str = String(rawInput).trim();
  if (!str) return '\n';

  if ((str.startsWith('"') && str.endsWith('"') && str.length >= 2) ||
      (str.startsWith("'") && str.endsWith("'") && str.length >= 2)) {
    try {
      str = JSON.parse(str);
    } catch {
      str = str.slice(1, -1);
    }
  }

  const hasArrayLengthPattern =
    /(?:int|long|size_t)\s+([a-zA-Z0-9_]+)\s*=\s*(?:[a-zA-Z0-9_.]*nextInt|cin\s*>>|scanf)/i.test(userCode) &&
    (/new\s+(?:int|long|double|String|float)\s*\[/i.test(userCode) ||
     /for\s*\([^;]*<\s*[a-zA-Z0-9_]+/i.test(userCode) ||
     /vector\s*<[a-zA-Z0-9_]+>\s*[a-zA-Z0-9_]+\s*\(/i.test(userCode));

  try {
    const parsed = JSON.parse(str);
    if (Array.isArray(parsed)) {
      if (hasArrayLengthPattern) {
        return `${parsed.length}\n${parsed.map(x => typeof x === 'object' ? JSON.stringify(x) : String(x)).join(' ')}\n`;
      }
      return `${parsed.map(x => typeof x === 'object' ? JSON.stringify(x) : String(x)).join(' ')}\n`;
    }
    if (typeof parsed === 'object' && parsed !== null) {
      const tokens: string[] = [];
      for (const [key, val] of Object.entries(parsed)) {
        if (Array.isArray(val)) {
          if (hasArrayLengthPattern) {
            tokens.push(String(val.length));
          }
          tokens.push(val.map(x => typeof x === 'object' ? JSON.stringify(x) : String(x)).join(' '));
        } else if (typeof val === 'string') {
          tokens.push(val);
        } else {
          tokens.push(String(val));
        }
      }
      return tokens.join('\n') + '\n';
    }
  } catch {}

  return str.endsWith('\n') ? str : str + '\n';
}

function normalizeOutput(val: string): string {
  if (!val) return '';
  let s = val.trim().replace(/\r\n/g, '\n');
  if ((s.startsWith('"') && s.endsWith('"') && s.length >= 2) ||
      (s.startsWith("'") && s.endsWith("'") && s.length >= 2)) {
    try {
      const unquoted = JSON.parse(s);
      if (typeof unquoted === 'string') return unquoted.trim();
    } catch {
      s = s.slice(1, -1).trim();
    }
  }
  return s;
}

function compareOutputs(actual: string, expected: string): boolean {
  const normA = normalizeOutput(actual);
  const normE = normalizeOutput(expected);
  if (normA === normE) return true;

  const compactA = normA.replace(/\s+/g, '');
  const compactE = normE.replace(/\s+/g, '');
  if (compactA === compactE) return true;

  if ((compactE.toLowerCase() === 'true' || compactE.toLowerCase() === 'false') &&
      compactA.toLowerCase() === compactE.toLowerCase()) {
    return true;
  }

  const numA = Number(compactA);
  const numE = Number(compactE);
  if (!isNaN(numA) && !isNaN(numE) && compactA !== '' && compactE !== '') {
    if (Math.abs(numA - numE) < 1e-6) return true;
  }

  return false;
}

export async function compileAndRun(
  code: string,
  language: SupportedLanguage,
  stdin: string = ''
): Promise<CompilerResult> {
  const startTime = Date.now();
  const runId = crypto.randomBytes(8).toString('hex');
  const tempDir = path.join(os.tmpdir(), `gdb_sandbox_${runId}`);
  fs.mkdirSync(tempDir, { recursive: true });

  const { preparedCode, primaryName } = prepareSourceCode(code, language);
  const formattedStdin = formatStdinForTestCase(stdin, code, language);

  try {
    if (language === 'typescript' || language === 'javascript' || (language as string) === 'js') {
      const jsFile = path.join(tempDir, 'solution.js');
      try {
        const transpiled = esbuild.transformSync(preparedCode, {
          loader: 'ts',
          target: 'es2022',
          format: 'cjs'
        });
        fs.writeFileSync(jsFile, transpiled.code, 'utf8');
      } catch (err: any) {
        const errText = err?.errors?.map((e: any) => `${e.location?.line || 1}:${e.location?.column || 1}: ${e.text}`).join('\n') || err.message;
        return {
          status: 'COMPILE_ERROR',
          stdout: '',
          stderr: `TypeScript Compilation Error:\n${errText}`,
          compilerError: `TypeScript Compilation Error:\n${errText}`,
          executionTimeMs: Date.now() - startTime,
          exitCode: 1
        };
      }
      const runRes = await runProcess(process.execPath, [jsFile], tempDir, formattedStdin, 5000);
      if (runRes.timedOut) {
        return {
          status: 'TIME_LIMIT_EXCEEDED',
          stdout: runRes.stdout,
          stderr: 'Time Limit Exceeded (5.0 seconds).',
          executionTimeMs: runRes.executionTimeMs,
          exitCode: -1
        };
      }
      if (runRes.exitCode !== 0) {
        return {
          status: 'RUNTIME_ERROR',
          stdout: runRes.stdout,
          stderr: runRes.stderr || `Node runtime exception (Exit code ${runRes.exitCode}).`,
          executionTimeMs: runRes.executionTimeMs,
          exitCode: runRes.exitCode
        };
      }
      return {
        status: 'ACCEPTED',
        stdout: runRes.stdout,
        stderr: runRes.stderr,
        executionTimeMs: runRes.executionTimeMs,
        exitCode: 0
      };
    }

    await ensureNativeToolchain(language);
    const nativeCmd = getNativeCompilerCommand(language);
    if (!nativeCmd) {
      return {
        status: 'COMPILE_ERROR',
        stdout: '',
        stderr: `Compiler for language '${language}' is not installed on this system.`,
        compilerError: `Compiler for language '${language}' is not installed on this system.`,
        executionTimeMs: 0,
        exitCode: 1
      };
    }

    switch (language) {
      case 'c': {
        const sourceFile = path.join(tempDir, 'main.c');
        const binFile = path.join(tempDir, process.platform === 'win32' ? 'main.exe' : 'main');
        fs.writeFileSync(sourceFile, preparedCode, 'utf8');
        const compileRes = await runProcess(nativeCmd, ['-O2', '-Wall', sourceFile, '-o', binFile, '-lm'], tempDir, '', 10000);
        if (compileRes.binaryMissing) {
          return {
            status: 'COMPILE_ERROR',
            stdout: '',
            stderr: 'GCC compiler binary could not be spawned.',
            compilerError: 'GCC compiler binary could not be spawned.',
            executionTimeMs: 0,
            exitCode: 1
          };
        }
        if (compileRes.exitCode !== 0) {
          const cleanErr = sanitizeCompilerOutput(compileRes.stderr || 'GCC compilation failed.', tempDir);
          return {
            status: 'COMPILE_ERROR',
            stdout: '',
            stderr: cleanErr,
            compilerError: cleanErr,
            executionTimeMs: compileRes.executionTimeMs,
            exitCode: compileRes.exitCode
          };
        }
        const runRes = await runProcess(binFile, [], tempDir, formattedStdin, 5000);
        if (runRes.timedOut) {
          return {
            status: 'TIME_LIMIT_EXCEEDED',
            stdout: sanitizeCompilerOutput(runRes.stdout, tempDir),
            stderr: 'Time Limit Exceeded (5.0 seconds). Check for infinite loops or unbuffered I/O.',
            executionTimeMs: runRes.executionTimeMs,
            exitCode: -1
          };
        }
        if (runRes.exitCode !== 0) {
          const cleanRunErr = sanitizeCompilerOutput(runRes.stderr || `Process terminated with exit code ${runRes.exitCode}`, tempDir);
          return {
            status: 'RUNTIME_ERROR',
            stdout: sanitizeCompilerOutput(runRes.stdout, tempDir),
            stderr: cleanRunErr,
            executionTimeMs: runRes.executionTimeMs,
            exitCode: runRes.exitCode
          };
        }
        return {
          status: 'ACCEPTED',
          stdout: runRes.stdout,
          stderr: runRes.stderr,
          executionTimeMs: runRes.executionTimeMs,
          exitCode: 0
        };
      }
      case 'cpp': {
        const sourceFile = path.join(tempDir, 'main.cpp');
        const binFile = path.join(tempDir, process.platform === 'win32' ? 'main.exe' : 'main');
        fs.writeFileSync(sourceFile, preparedCode, 'utf8');
        const compileRes = await runProcess(nativeCmd, ['-O2', '-Wall', '-std=c++17', sourceFile, '-o', binFile, '-lm'], tempDir, '', 10000);
        if (compileRes.binaryMissing) {
          return {
            status: 'COMPILE_ERROR',
            stdout: '',
            stderr: 'G++ compiler binary could not be spawned.',
            compilerError: 'G++ compiler binary could not be spawned.',
            executionTimeMs: 0,
            exitCode: 1
          };
        }
        if (compileRes.exitCode !== 0) {
          const cleanErr = sanitizeCompilerOutput(compileRes.stderr || 'G++ compilation failed.', tempDir);
          return {
            status: 'COMPILE_ERROR',
            stdout: '',
            stderr: cleanErr,
            compilerError: cleanErr,
            executionTimeMs: compileRes.executionTimeMs,
            exitCode: compileRes.exitCode
          };
        }
        const runRes = await runProcess(binFile, [], tempDir, formattedStdin, 5000);
        if (runRes.timedOut) {
          return {
            status: 'TIME_LIMIT_EXCEEDED',
            stdout: sanitizeCompilerOutput(runRes.stdout, tempDir),
            stderr: 'Time Limit Exceeded (5.0 seconds). Check for infinite loops or unbuffered I/O.',
            executionTimeMs: runRes.executionTimeMs,
            exitCode: -1
          };
        }
        if (runRes.exitCode !== 0) {
          const cleanRunErr = sanitizeCompilerOutput(runRes.stderr || `Process terminated with exit code ${runRes.exitCode}`, tempDir);
          return {
            status: 'RUNTIME_ERROR',
            stdout: sanitizeCompilerOutput(runRes.stdout, tempDir),
            stderr: cleanRunErr,
            executionTimeMs: runRes.executionTimeMs,
            exitCode: runRes.exitCode
          };
        }
        return {
          status: 'ACCEPTED',
          stdout: runRes.stdout,
          stderr: runRes.stderr,
          executionTimeMs: runRes.executionTimeMs,
          exitCode: 0
        };
      }
      case 'java': {
        const className = primaryName || 'Solution';
        const sourceFile = path.join(tempDir, `${className}.java`);
        fs.writeFileSync(sourceFile, preparedCode, 'utf8');
        const compileRes = await runProcess(nativeCmd, [sourceFile], tempDir, '', 10000);
        if (compileRes.binaryMissing) {
          return {
            status: 'COMPILE_ERROR',
            stdout: '',
            stderr: 'Javac compiler binary could not be spawned.',
            compilerError: 'Javac compiler binary could not be spawned.',
            executionTimeMs: 0,
            exitCode: 1
          };
        }
        if (compileRes.exitCode !== 0) {
          const cleanErr = sanitizeCompilerOutput(compileRes.stderr || 'Javac compilation failed.', tempDir);
          return {
            status: 'COMPILE_ERROR',
            stdout: '',
            stderr: cleanErr,
            compilerError: cleanErr,
            executionTimeMs: compileRes.executionTimeMs,
            exitCode: compileRes.exitCode
          };
        }
        const javaBin = resolveExecutable(['java']) || 'java';
        const runRes = await runProcess(javaBin, ['-cp', tempDir, className], tempDir, formattedStdin, 6000);
        if (runRes.binaryMissing) {
          return {
            status: 'RUNTIME_ERROR',
            stdout: '',
            stderr: 'Java JVM runtime (java) could not be spawned.',
            executionTimeMs: 0,
            exitCode: 1
          };
        }
        if (runRes.timedOut) {
          return {
            status: 'TIME_LIMIT_EXCEEDED',
            stdout: sanitizeCompilerOutput(runRes.stdout, tempDir),
            stderr: 'Time Limit Exceeded (6.0 seconds). Check for infinite loops or blocking input.',
            executionTimeMs: runRes.executionTimeMs,
            exitCode: -1
          };
        }
        if (runRes.exitCode !== 0) {
          const cleanRunErr = sanitizeCompilerOutput(runRes.stderr || `JVM terminated with exit code ${runRes.exitCode}`, tempDir);
          return {
            status: 'RUNTIME_ERROR',
            stdout: sanitizeCompilerOutput(runRes.stdout, tempDir),
            stderr: cleanRunErr,
            executionTimeMs: runRes.executionTimeMs,
            exitCode: runRes.exitCode
          };
        }
        return {
          status: 'ACCEPTED',
          stdout: runRes.stdout,
          stderr: runRes.stderr,
          executionTimeMs: runRes.executionTimeMs,
          exitCode: 0
        };
      }
      case 'python': {
        const sourceFile = path.join(tempDir, 'solution.py');
        fs.writeFileSync(sourceFile, preparedCode, 'utf8');
        const checkRes = await runProcess(nativeCmd, ['-m', 'py_compile', sourceFile], tempDir, '', 5000);
        if (checkRes.binaryMissing) {
          return {
            status: 'COMPILE_ERROR',
            stdout: '',
            stderr: 'Python interpreter could not be spawned.',
            compilerError: 'Python interpreter could not be spawned.',
            executionTimeMs: 0,
            exitCode: 1
          };
        }
        if (checkRes.exitCode !== 0) {
          const cleanErr = sanitizeCompilerOutput(checkRes.stderr || 'Python syntax error.', tempDir);
          return {
            status: 'COMPILE_ERROR',
            stdout: '',
            stderr: cleanErr,
            compilerError: cleanErr,
            executionTimeMs: checkRes.executionTimeMs,
            exitCode: checkRes.exitCode
          };
        }
        const runRes = await runProcess(nativeCmd, ['-u', sourceFile], tempDir, formattedStdin, 5000);
        if (runRes.binaryMissing) {
          return {
            status: 'RUNTIME_ERROR',
            stdout: '',
            stderr: 'Python runtime execution failed.',
            executionTimeMs: 0,
            exitCode: 1
          };
        }
        if (runRes.timedOut) {
          return {
            status: 'TIME_LIMIT_EXCEEDED',
            stdout: sanitizeCompilerOutput(runRes.stdout, tempDir),
            stderr: 'Time Limit Exceeded (5.0 seconds). Check for infinite loops.',
            executionTimeMs: runRes.executionTimeMs,
            exitCode: -1
          };
        }
        if (runRes.exitCode !== 0) {
          const cleanRunErr = sanitizeCompilerOutput(runRes.stderr || `Python script raised an exception (Exit code ${runRes.exitCode}).`, tempDir);
          return {
            status: 'RUNTIME_ERROR',
            stdout: sanitizeCompilerOutput(runRes.stdout, tempDir),
            stderr: cleanRunErr,
            executionTimeMs: runRes.executionTimeMs,
            exitCode: runRes.exitCode
          };
        }
        return {
          status: 'ACCEPTED',
          stdout: runRes.stdout,
          stderr: runRes.stderr,
          executionTimeMs: runRes.executionTimeMs,
          exitCode: 0
        };
      }
      default:
        return {
          status: 'COMPILE_ERROR',
          stdout: '',
          stderr: `Unsupported language: ${language}`,
          compilerError: `Unsupported language: ${language}`,
          executionTimeMs: 0,
          exitCode: 1
        };
    }
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  }
}

function summarizeTestResults(
  questionId: string,
  totalCases: number,
  passedCases: number,
  hiddenTestCases: any[],
  testResults: SingleTestResult[]
): CodeExecutionResponse {
  const totalHiddenCases = hiddenTestCases.length;
  const passedHiddenCases = testResults.filter(r => r.isHidden && r.passed).length;
  const scoreAwarded = totalHiddenCases > 0
    ? (passedHiddenCases === totalHiddenCases ? 10 : Math.round((passedHiddenCases / totalHiddenCases) * 10))
    : (passedCases === totalCases ? 10 : Math.round((passedCases / totalCases) * 10));

  const firstTle = testResults.find(r => r.actualOutput === 'TIME_LIMIT_EXCEEDED');
  const firstRe = testResults.find(r => r.actualOutput === 'RUNTIME_ERROR');
  const firstWa = testResults.find(r => !r.passed && r.actualOutput !== 'TIME_LIMIT_EXCEEDED' && r.actualOutput !== 'RUNTIME_ERROR');

  let status: 'ACCEPTED' | 'WRONG_ANSWER' | 'RUNTIME_ERROR' | 'COMPILE_ERROR' | 'TIME_LIMIT_EXCEEDED' = 'WRONG_ANSWER';
  let outputMessage = '';

  if (passedCases === totalCases) {
    status = 'ACCEPTED';
    outputMessage = `Accepted: All ${totalCases} test cases passed (${passedHiddenCases}/${totalHiddenCases} hidden test cases passed). 10/10 marks awarded.`;
  } else if (firstRe && passedCases === 0) {
    status = 'RUNTIME_ERROR';
    const idx = testResults.indexOf(firstRe) + 1;
    outputMessage = `Runtime Error on Test Case ${idx}:\n${firstRe.error || 'Execution crashed'}`;
  } else if (firstTle && passedCases === 0) {
    status = 'TIME_LIMIT_EXCEEDED';
    const idx = testResults.indexOf(firstTle) + 1;
    outputMessage = `Time Limit Exceeded on Test Case ${idx} (Terminated after 4.0s). Check for infinite loops or non-terminating recursion.`;
  } else if (firstRe) {
    status = 'RUNTIME_ERROR';
    const idx = testResults.indexOf(firstRe) + 1;
    outputMessage = `Runtime Error on Test Case ${idx} (${passedCases}/${totalCases} passed):\n${firstRe.error}`;
  } else if (firstTle) {
    status = 'TIME_LIMIT_EXCEEDED';
    const idx = testResults.indexOf(firstTle) + 1;
    outputMessage = `Time Limit Exceeded on Test Case ${idx} (${passedCases}/${totalCases} passed).`;
  } else {
    status = 'WRONG_ANSWER';
    const idx = firstWa ? testResults.indexOf(firstWa) + 1 : 1;
    outputMessage = firstWa
      ? `Wrong Answer on Test Case ${idx} (${passedCases}/${totalCases} passed).\nInput: ${firstWa.input}\nYour Output: ${firstWa.actualOutput}\nExpected: ${firstWa.expectedOutput}`
      : `${passedCases}/${totalCases} test cases passed (${scoreAwarded}/10 marks awarded).`;
  }

  return {
    questionId,
    status,
    totalCases,
    passedCases,
    scoreAwarded,
    hiddenCasesTotal: totalHiddenCases,
    hiddenCasesPassed: passedHiddenCases,
    testResults,
    outputMessage
  };
}

export async function executeAgainstTestCases(
  code: string,
  language: SupportedLanguage,
  question: CodingQuestion
): Promise<CodeExecutionResponse> {
  const runId = crypto.randomBytes(8).toString('hex');
  const tempDir = path.join(os.tmpdir(), `gdb_exec_${runId}`);
  fs.mkdirSync(tempDir, { recursive: true });

  const questionId = question?.id || 'question';
  const resolvedTestCases: TestCase[] = Array.isArray(question?.testCases) && question.testCases.length > 0
    ? question.testCases
    : (Array.isArray(question as any) && (question as any).length > 0
      ? (question as any)
      : (Array.isArray((question as any)?.examples) && (question as any).examples.length > 0
        ? (question as any).examples.map((ex: any, idx: number) => ({
            id: `ex_${idx + 1}`,
            input: String(ex.input ?? ''),
            expectedOutput: String(ex.output ?? ex.expectedOutput ?? ''),
            isHidden: false
          }))
        : [{ id: 'tc_1', input: '', expectedOutput: '', isHidden: false }]));

  const testResults: SingleTestResult[] = [];
  let passedCases = 0;
  let overallCompilerError = '';
  const { preparedCode, primaryName } = prepareSourceCode(code, language);

  try {
    if (language === 'typescript' || language === 'javascript' || (language as string) === 'js') {
      const jsFile = path.join(tempDir, 'solution.js');
      try {
        const transpiled = esbuild.transformSync(preparedCode, {
          loader: 'ts',
          target: 'es2022',
          format: 'cjs'
        });
        fs.writeFileSync(jsFile, transpiled.code, 'utf8');
      } catch (err: any) {
        const cleanErr = err?.errors?.map((e: any) => `${e.location?.line || 1}:${e.location?.column || 1}: ${e.text}`).join('\n') || err.message;
        const hiddenCount = resolvedTestCases.filter(tc => tc.isHidden).length;
        return {
          questionId,
          status: 'COMPILE_ERROR',
          totalCases: resolvedTestCases.length,
          passedCases: 0,
          scoreAwarded: 0,
          hiddenCasesTotal: hiddenCount,
          hiddenCasesPassed: 0,
          testResults: resolvedTestCases.map((tc) => ({
            testCaseId: tc.id,
            input: tc.isHidden ? '[HIDDEN SPEC]' : tc.input,
            expectedOutput: tc.isHidden ? '[HIDDEN]' : tc.expectedOutput,
            actualOutput: 'COMPILATION_FAILED',
            passed: false,
            isHidden: tc.isHidden,
            error: cleanErr,
            executionTimeMs: 0
          })),
          outputMessage: `TypeScript Compilation Error:\n${cleanErr}`
        };
      }

      for (const tc of resolvedTestCases) {
        const formattedInput = formatStdinForTestCase(tc.input, code, 'typescript');
        const runRes = await runProcess(process.execPath, [jsFile], tempDir, formattedInput, 4000);

        if (runRes.timedOut) {
          testResults.push({
            testCaseId: tc.id,
            input: tc.isHidden ? '[HIDDEN SPEC]' : tc.input,
            expectedOutput: tc.isHidden ? '[HIDDEN]' : tc.expectedOutput,
            actualOutput: 'TIME_LIMIT_EXCEEDED',
            passed: false,
            isHidden: tc.isHidden,
            error: 'Time Limit Exceeded (4.0s). Check for infinite loops or non-terminating recursion.',
            executionTimeMs: runRes.executionTimeMs
          });
          const currIdx = resolvedTestCases.indexOf(tc);
          for (let i = currIdx + 1; i < resolvedTestCases.length; i++) {
            const rem = resolvedTestCases[i];
            testResults.push({
              testCaseId: rem.id,
              input: rem.isHidden ? '[HIDDEN SPEC]' : rem.input,
              expectedOutput: rem.isHidden ? '[HIDDEN]' : rem.expectedOutput,
              actualOutput: 'TIME_LIMIT_EXCEEDED',
              passed: false,
              isHidden: rem.isHidden,
              error: 'Skipped due to Time Limit Exceeded on previous test case.',
              executionTimeMs: 0
            });
          }
          break;
        }

        if (runRes.exitCode !== 0) {
          const cleanErr = sanitizeCompilerOutput(runRes.stderr || runRes.stdout || `Exit code ${runRes.exitCode}`, tempDir);
          testResults.push({
            testCaseId: tc.id,
            input: tc.isHidden ? '[HIDDEN SPEC]' : tc.input,
            expectedOutput: tc.isHidden ? '[HIDDEN]' : tc.expectedOutput,
            actualOutput: 'RUNTIME_ERROR',
            passed: false,
            isHidden: tc.isHidden,
            error: cleanErr,
            executionTimeMs: runRes.executionTimeMs
          });
          continue;
        }

        const isPassed = compareOutputs(runRes.stdout, tc.expectedOutput);
        const normActual = normalizeOutput(runRes.stdout);
        if (isPassed) passedCases++;
        testResults.push({
          testCaseId: tc.id,
          input: tc.isHidden ? '[HIDDEN SPEC]' : tc.input,
          expectedOutput: tc.isHidden ? '[HIDDEN]' : tc.expectedOutput,
          actualOutput: tc.isHidden ? (isPassed ? '[MATCHED HIDDEN SPEC]' : '[MISMATCH]') : normActual,
          passed: isPassed,
          isHidden: tc.isHidden,
          executionTimeMs: runRes.executionTimeMs
        });
      }

      const hiddenTestCases = resolvedTestCases.filter(tc => tc.isHidden);
      return summarizeTestResults(
        questionId,
        resolvedTestCases.length,
        passedCases,
        hiddenTestCases,
        testResults
      );
    }

    await ensureNativeToolchain(language);
    const nativeCmd = getNativeCompilerCommand(language);
    if (!nativeCmd) {
      const hiddenCount = resolvedTestCases.filter(tc => tc.isHidden).length;
      return {
        questionId,
        status: 'COMPILE_ERROR',
        totalCases: resolvedTestCases.length,
        passedCases: 0,
        scoreAwarded: 0,
        hiddenCasesTotal: hiddenCount,
        hiddenCasesPassed: 0,
        testResults: resolvedTestCases.map((tc) => ({
          testCaseId: tc.id,
          input: tc.isHidden ? '[HIDDEN SPEC]' : tc.input,
          expectedOutput: tc.isHidden ? '[HIDDEN]' : tc.expectedOutput,
          actualOutput: 'COMPILATION_FAILED',
          passed: false,
          isHidden: tc.isHidden,
          error: `Compiler for language '${language}' is not installed on this system.`,
          executionTimeMs: 0
        })),
        outputMessage: `Compiler for language '${language}' is not installed on this system.`
      };
    }

    let runCommand: { cmd: string; args: string[]; timeoutMs: number } | null = null;
    switch (language) {
      case 'c': {
        const sourceFile = path.join(tempDir, 'main.c');
        const binFile = path.join(tempDir, process.platform === 'win32' ? 'main.exe' : 'main');
        fs.writeFileSync(sourceFile, preparedCode, 'utf8');
        const compileRes = await runProcess(nativeCmd, ['-O2', '-Wall', sourceFile, '-o', binFile, '-lm'], tempDir, '', 10000);
        if (compileRes.binaryMissing) {
          overallCompilerError = 'GCC compiler binary could not be spawned.';
        } else if (compileRes.exitCode !== 0) {
          overallCompilerError = sanitizeCompilerOutput(compileRes.stderr || compileRes.stdout || 'GCC compilation failed.', tempDir);
        } else {
          runCommand = { cmd: binFile, args: [], timeoutMs: 4000 };
        }
        break;
      }
      case 'cpp': {
        const sourceFile = path.join(tempDir, 'main.cpp');
        const binFile = path.join(tempDir, process.platform === 'win32' ? 'main.exe' : 'main');
        fs.writeFileSync(sourceFile, preparedCode, 'utf8');
        const compileRes = await runProcess(nativeCmd, ['-O2', '-Wall', '-std=c++17', sourceFile, '-o', binFile, '-lm'], tempDir, '', 10000);
        if (compileRes.binaryMissing) {
          overallCompilerError = 'G++ compiler binary could not be spawned.';
        } else if (compileRes.exitCode !== 0) {
          overallCompilerError = sanitizeCompilerOutput(compileRes.stderr || compileRes.stdout || 'G++ compilation failed.', tempDir);
        } else {
          runCommand = { cmd: binFile, args: [], timeoutMs: 4000 };
        }
        break;
      }
      case 'java': {
        const className = primaryName || 'Solution';
        const sourceFile = path.join(tempDir, `${className}.java`);
        fs.writeFileSync(sourceFile, preparedCode, 'utf8');
        const compileRes = await runProcess(nativeCmd, [sourceFile], tempDir, '', 10000);
        if (compileRes.binaryMissing) {
          overallCompilerError = 'Javac compiler binary could not be spawned.';
        } else if (compileRes.exitCode !== 0) {
          overallCompilerError = sanitizeCompilerOutput(compileRes.stderr || compileRes.stdout || 'Javac compilation failed.', tempDir);
        } else {
          const javaBin = resolveExecutable(['java']) || 'java';
          runCommand = { cmd: javaBin, args: ['-cp', tempDir, className], timeoutMs: 5000 };
        }
        break;
      }
      case 'python': {
        const sourceFile = path.join(tempDir, 'solution.py');
        fs.writeFileSync(sourceFile, preparedCode, 'utf8');
        const checkRes = await runProcess(nativeCmd, ['-m', 'py_compile', sourceFile], tempDir, '', 5000);
        if (checkRes.binaryMissing) {
          overallCompilerError = 'Python interpreter could not be spawned.';
        } else if (checkRes.exitCode !== 0) {
          overallCompilerError = sanitizeCompilerOutput(checkRes.stderr || checkRes.stdout || 'Python syntax error.', tempDir);
        } else {
          runCommand = { cmd: nativeCmd, args: ['-u', sourceFile], timeoutMs: 4000 };
        }
        break;
      }
      default:
        overallCompilerError = `Unsupported language: ${language}`;
        break;
    }

    if (overallCompilerError || !runCommand) {
      const hiddenCount = resolvedTestCases.filter(tc => tc.isHidden).length;
      return {
        questionId,
        status: 'COMPILE_ERROR',
        totalCases: resolvedTestCases.length,
        passedCases: 0,
        scoreAwarded: 0,
        hiddenCasesTotal: hiddenCount,
        hiddenCasesPassed: 0,
        testResults: resolvedTestCases.map((tc) => ({
          testCaseId: tc.id,
          input: tc.isHidden ? '[HIDDEN SPEC]' : tc.input,
          expectedOutput: tc.isHidden ? '[HIDDEN]' : tc.expectedOutput,
          actualOutput: 'COMPILATION_FAILED',
          passed: false,
          isHidden: tc.isHidden,
          error: overallCompilerError,
          executionTimeMs: 0
        })),
        outputMessage: overallCompilerError
      };
    }

    for (const tc of resolvedTestCases) {
      const formattedInput = formatStdinForTestCase(tc.input, code, language);
      const runRes = await runProcess(
        runCommand.cmd,
        runCommand.args,
        tempDir,
        formattedInput,
        runCommand.timeoutMs
      );

      if (runRes.binaryMissing) {
        testResults.push({
          testCaseId: tc.id,
          input: tc.isHidden ? '[HIDDEN SPEC]' : tc.input,
          expectedOutput: tc.isHidden ? '[HIDDEN]' : tc.expectedOutput,
          actualOutput: 'EXECUTION_FAILED',
          passed: false,
          isHidden: tc.isHidden,
          error: `Executable ${runCommand.cmd} could not be launched.`,
          executionTimeMs: 0
        });
        continue;
      }

      if (runRes.timedOut) {
        testResults.push({
          testCaseId: tc.id,
          input: tc.isHidden ? '[HIDDEN SPEC]' : tc.input,
          expectedOutput: tc.isHidden ? '[HIDDEN]' : tc.expectedOutput,
          actualOutput: 'TIME_LIMIT_EXCEEDED',
          passed: false,
          isHidden: tc.isHidden,
          error: 'Time Limit Exceeded (4.0s). Check for infinite loops or non-terminating recursion.',
          executionTimeMs: runRes.executionTimeMs
        });
        const currIdx = resolvedTestCases.indexOf(tc);
        for (let i = currIdx + 1; i < resolvedTestCases.length; i++) {
          const rem = resolvedTestCases[i];
          testResults.push({
            testCaseId: rem.id,
            input: rem.isHidden ? '[HIDDEN SPEC]' : rem.input,
            expectedOutput: rem.isHidden ? '[HIDDEN]' : rem.expectedOutput,
            actualOutput: 'TIME_LIMIT_EXCEEDED',
            passed: false,
            isHidden: rem.isHidden,
            error: 'Skipped due to Time Limit Exceeded on previous test case.',
            executionTimeMs: 0
          });
        }
        break;
      }

      if (runRes.exitCode !== 0) {
        const cleanRunErr = sanitizeCompilerOutput(runRes.stderr || runRes.stdout || `Runtime error with exit code ${runRes.exitCode}`, tempDir);
        testResults.push({
          testCaseId: tc.id,
          input: tc.isHidden ? '[HIDDEN SPEC]' : tc.input,
          expectedOutput: tc.isHidden ? '[HIDDEN]' : tc.expectedOutput,
          actualOutput: 'RUNTIME_ERROR',
          passed: false,
          isHidden: tc.isHidden,
          error: cleanRunErr,
          executionTimeMs: runRes.executionTimeMs
        });
        continue;
      }

      const isPassed = compareOutputs(runRes.stdout, tc.expectedOutput);
      const normActual = normalizeOutput(runRes.stdout);
      if (isPassed) {
        passedCases++;
      }
      testResults.push({
        testCaseId: tc.id,
        input: tc.isHidden ? '[HIDDEN SPEC]' : tc.input,
        expectedOutput: tc.isHidden ? '[HIDDEN]' : tc.expectedOutput,
        actualOutput: tc.isHidden ? (isPassed ? '[MATCHED HIDDEN SPEC]' : '[MISMATCH]') : normActual,
        passed: isPassed,
        isHidden: tc.isHidden,
        executionTimeMs: runRes.executionTimeMs
      });
    }

    const hiddenTestCases = resolvedTestCases.filter(tc => tc.isHidden);
    return summarizeTestResults(
      questionId,
      resolvedTestCases.length,
      passedCases,
      hiddenTestCases,
      testResults
    );
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  }
}
