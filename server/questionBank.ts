import { AptitudeQuestion, CodingQuestion } from '../src/types';

export const APTITUDE_QUESTION_BANK: AptitudeQuestion[] = [
  {
    id: 'apt-01',
    topic: 'Quantitative Aptitude',
    question: 'A can complete a project in 12 days, and B can complete the same project in 18 days. If they work on alternate days starting with A, in how many days will the work be completed?',
    options: ['14 1/3 days', '14 1/2 days', '15 days', '14 days'],
    correctAnswerIndex: 0,
    explanation: 'A does 1/12 and B does 1/18 per day. In 2 days, work done = 1/12 + 1/18 = 5/36. In 14 days (7 pairs), work done = 35/36. Remaining work = 1/36. On day 15, A works at rate 1/12, taking (1/36) / (1/12) = 1/3 day. Total = 14 1/3 days.',
    marks: 10
  },
  {
    id: 'apt-02',
    topic: 'Quantitative Aptitude',
    question: 'A bag contains 5 red, 4 green, and 3 blue marbles. If two marbles are drawn at random without replacement, what is the probability that both are of the same color?',
    options: ['19/66', '13/66', '7/22', '5/18'],
    correctAnswerIndex: 0,
    explanation: 'Total marbles = 12. P(both red) = (5/12)*(4/11) = 20/132. P(both green) = (4/12)*(3/11) = 12/132. P(both blue) = (3/12)*(2/11) = 6/132. Total = (20+12+6)/132 = 38/132 = 19/66.',
    marks: 10
  },
  {
    id: 'apt-03',
    topic: 'Operating Systems',
    question: 'Which of the following conditions is NOT one of Coffman\'s four necessary conditions for a deadlock to occur?',
    options: ['Mutual Exclusion', 'Preemption', 'Hold and Wait', 'Circular Wait'],
    correctAnswerIndex: 1,
    explanation: 'Coffman\'s four conditions are: Mutual Exclusion, Hold and Wait, No Preemption, and Circular Wait. "Preemption" prevents deadlock rather than being a condition for it.',
    marks: 10
  },
  {
    id: 'apt-04',
    topic: 'Computer Networks',
    question: 'In the TCP 3-Way Handshake, which sequence of flags is exchanged between the client and server to establish a connection?',
    options: ['SYN -> SYN-ACK -> ACK', 'ACK -> SYN -> ACK', 'SYN -> ACK -> FIN', 'FIN -> ACK -> SYN'],
    correctAnswerIndex: 0,
    explanation: 'TCP connection establishment follows: Client sends SYN, Server responds with SYN-ACK, and Client confirms with ACK.',
    marks: 10
  },
  {
    id: 'apt-05',
    topic: 'Data Structures & Algorithms',
    question: 'What is the worst-case time complexity of searching for an element in a Balanced Red-Black Binary Search Tree with N nodes?',
    options: ['O(N)', 'O(log N)', 'O(1)', 'O(N log N)'],
    correctAnswerIndex: 1,
    explanation: 'In a Red-Black Tree, the maximum height is bounded by 2 * log2(N + 1). Thus, search, insertion, and deletion all take O(log N) in the worst case.',
    marks: 10
  },
  {
    id: 'apt-06',
    topic: 'Database Systems',
    question: 'Which ACID property guarantees that once a transaction has committed, its changes will survive crashes, power outages, and system restarts?',
    options: ['Atomicity', 'Consistency', 'Isolation', 'Durability'],
    correctAnswerIndex: 3,
    explanation: 'Durability ensures that once a transaction commits, its modifications are permanently recorded in non-volatile storage (via WAL or redo logs).',
    marks: 10
  },
  {
    id: 'apt-07',
    topic: 'Logical Reasoning',
    question: 'Find the next number in the sequence: 4, 11, 30, 67, 128, ?',
    options: ['219', '216', '222', '225'],
    correctAnswerIndex: 0,
    explanation: 'The pattern follows n^3 + 3: 1^3 + 3 = 4, 2^3 + 3 = 11, 3^3 + 3 = 30, 4^3 + 3 = 67, 5^3 + 3 = 128, 6^3 + 3 = 216 + 3 = 219.',
    marks: 10
  },
  {
    id: 'apt-08',
    topic: 'System Architecture',
    question: 'In distributed systems, the CAP theorem states that a distributed data store can simultaneously provide at most two of which three guarantees?',
    options: ['Consistency, Availability, Partition Tolerance', 'Concurrency, Atomicity, Persistence', 'Coherence, Authentication, Performance', 'Capacity, Availability, Parallelism'],
    correctAnswerIndex: 0,
    explanation: 'Brewer\'s CAP Theorem states that across an asynchronous network subject to partitions (P), a distributed system can guarantee at most Consistency (C) or Availability (A).',
    marks: 10
  },
  {
    id: 'apt-09',
    topic: 'Quantitative Aptitude',
    question: 'Two trains of lengths 140 m and 160 m run on parallel tracks in opposite directions at speeds of 60 km/h and 48 km/h respectively. How long will it take for them to clear each other?',
    options: ['10 seconds', '12 seconds', '8.5 seconds', '15 seconds'],
    correctAnswerIndex: 0,
    explanation: 'Relative speed = 60 + 48 = 108 km/h = 108 * (5/18) = 30 m/s. Total distance = 140 + 160 = 300 m. Time = 300 / 30 = 10 seconds.',
    marks: 10
  },
  {
    id: 'apt-10',
    topic: 'Logical Reasoning',
    question: 'In a certain code language, if "SYSTEM" is written as "SYSMET" and "NEARER" is written as "AENRER", how is "FRACTION" written in that code?',
    options: ['CARFNOIT', 'CARFTION', 'ARFCNOIT', 'FRACNOIT'],
    correctAnswerIndex: 0,
    explanation: 'Divide the word into two equal halves. Reverse each half: "FRAC" reversed is "CARF"; "TION" reversed is "NOIT". Combining gives "CARFNOIT".',
    marks: 10
  },
  {
    id: 'apt-11',
    topic: 'Operating Systems',
    question: 'What is "Thrashing" in an operating system?',
    options: [
      'A condition where CPU spends excessive time swapping pages into and out of memory rather than executing instructions',
      'A deadlock condition between two threads accessing shared cache',
      'The rapid destruction of zombie processes by the init daemon',
      'A failure of the I/O scheduler due to disk head vibration'
    ],
    correctAnswerIndex: 0,
    explanation: 'Thrashing occurs when the system spends more time servicing page faults and paging than executing application code.',
    marks: 10
  },
  {
    id: 'apt-12',
    topic: 'Computer Networks',
    question: 'Which HTTP status code signifies that the server received and understood the request, but refuses to authorize it due to permission restrictions?',
    options: ['401 Unauthorized', '403 Forbidden', '404 Not Found', '405 Method Not Allowed'],
    correctAnswerIndex: 1,
    explanation: '403 Forbidden indicates the server understands who the client is, but denies access. 401 Unauthorized indicates authentication is missing or invalid.',
    marks: 10
  },
  {
    id: 'apt-13',
    topic: 'Database Systems',
    question: 'Which database isolation level prevents Dirty Reads and Non-Repeatable Reads, but may still permit Phantom Reads under the ANSI SQL standard?',
    options: ['Read Uncommitted', 'Read Committed', 'Repeatable Read', 'Serializable'],
    correctAnswerIndex: 2,
    explanation: 'Under ANSI SQL-92, Repeatable Read guarantees no dirty reads and no non-repeatable reads, while Serializable additionally prevents phantom reads.',
    marks: 10
  },
  {
    id: 'apt-14',
    topic: 'Data Structures & Algorithms',
    question: 'Which sorting algorithm has a guaranteed worst-case time complexity of O(N log N) and can be implemented as an in-place sort with O(1) auxiliary space?',
    options: ['Merge Sort', 'Heap Sort', 'Quick Sort', 'Counting Sort'],
    correctAnswerIndex: 1,
    explanation: 'Heap Sort achieves O(N log N) worst-case time complexity while requiring only O(1) auxiliary space. Merge Sort requires O(N) auxiliary space, and Quick Sort worst-case is O(N^2).',
    marks: 10
  },
  {
    id: 'apt-15',
    topic: 'Quantitative Aptitude',
    question: 'A shopkeeper marks an article at 40% above cost price and allows a 20% discount on marked price. What is the net profit percentage?',
    options: ['12%', '15%', '20%', '10%'],
    correctAnswerIndex: 0,
    explanation: 'Let CP = 100. MP = 140. SP = 140 * 0.80 = 112. Profit = 112 - 100 = 12%.',
    marks: 10
  },
  {
    id: 'apt-16',
    topic: 'Logical Reasoning',
    question: 'Pointing to a photograph, Rohit said, "She is the daughter of my grandfather\'s only son." How is the person in the photograph related to Rohit?',
    options: ['Sister', 'Mother', 'Cousin', 'Aunt'],
    correctAnswerIndex: 0,
    explanation: 'Rohit\'s grandfather\'s only son is Rohit\'s father. The daughter of Rohit\'s father is Rohit\'s sister.',
    marks: 10
  }
];

export const CODING_QUESTION_BANK: CodingQuestion[] = [
  {
    id: 'algo-subarray-sum',
    title: 'Subarray Sum Equals K',
    difficulty: 'Medium',
    marks: 10,
    description: 'Given an array of integers `nums` and an integer `k`, return the total number of continuous subarrays whose sum equals to `k`.\n\nYour solution must read input from standard input (stdin) or implement the solution function appropriately, and output the single integer result to standard output.',
    constraints: [
      '1 <= nums.length <= 20,000',
      '-1000 <= nums[i] <= 1000',
      '-10^7 <= k <= 10^7'
    ],
    examples: [
      { input: 'nums = [1,1,1], k = 2', output: '2', explanation: '[1,1] at index (0,1) and (1,2) sum to 2.' },
      { input: 'nums = [1,2,3], k = 3', output: '2', explanation: '[1,2] and [3] sum to 3.' }
    ],
    starterCode: {
      c: `// C (GCC) - Subarray Sum Equals K\n#include <stdio.h>\n#include <stdlib.h>\nint subarraySum(int* nums, int numsSize, int k) {\n    int count = 0;\n    return count;\n}\nint main() {\n    int n, k;\n    if (scanf("%d %d", &n, &k) == 2) {\n        int* arr = (int*)malloc(sizeof(int) * n);\n        for (int i = 0; i < n; i++) scanf("%d", &arr[i]);\n        printf("%d\\n", subarraySum(arr, n, k));\n        free(arr);\n    }\n    return 0;\n}`,
      cpp: `// C++ (G++) - Subarray Sum Equals K\n#include <iostream>\n#include <vector>\n#include <unordered_map>\nusing namespace std;\nint subarraySum(vector<int>& nums, int k) {\n    int count = 0;\n    return count;\n}\nint main() {\n    int n, k;\n    if (cin >> n >> k) {\n        vector<int> nums(n);\n        for (int i = 0; i < n; ++i) cin >> nums[i];\n        cout << subarraySum(nums, k) << endl;\n    }\n    return 0;\n}`,
      java: `// Java (OpenJDK) - Subarray Sum Equals K\nimport java.util.*;\npublic class Solution {\n    public static int subarraySum(int[] nums, int k) {\n        int count = 0;\n        return count;\n    }\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        if (sc.hasNextInt()) {\n            int n = sc.nextInt();\n            int k = sc.nextInt();\n            int[] nums = new int[n];\n            for (int i = 0; i < n; i++) nums[i] = sc.nextInt();\n            System.out.println(subarraySum(nums, k));\n        }\n    }\n}`,
      python: `# Python 3 - Subarray Sum Equals K\nimport sys\ndef subarray_sum(nums, k):\n    count = 0\n    return count\nif __name__ == '__main__':\n    data = sys.stdin.read().split()\n    if data:\n        n = int(data[0])\n        k = int(data[1])\n        nums = [int(x) for x in data[2:2+n]]\n        print(subarray_sum(nums, k))`,
      typescript: `// TypeScript - Subarray Sum Equals K\nimport * as fs from 'fs';\nexport function subarraySum(nums: number[], k: number): number {\n    let count = 0;\n    return count;\n}\nconst input = fs.readFileSync(0, 'utf-8').trim().split(/\\s+/);\nif (input.length >= 2 && input[0] !== '') {\n    const n = parseInt(input[0], 10);\n    const k = parseInt(input[1], 10);\n    const nums = input.slice(2, 2 + n).map(x => parseInt(x, 10));\n    console.log(subarraySum(nums, k));\n}`
    },
    testCases: [
      { id: 'tc-1', input: '3 2\n1 1 1', expectedOutput: '2', isHidden: false, explanation: '[1,1] at (0,1) and (1,2)' },
      { id: 'tc-2', input: '3 3\n1 2 3', expectedOutput: '2', isHidden: false, explanation: '[1,2] and [3]' },
      { id: 'tc-3', input: '5 0\n0 0 0 0 0', expectedOutput: '15', isHidden: true, explanation: 'All combinations of 0s' },
      { id: 'tc-4', input: '6 7\n3 4 7 2 -3 8', expectedOutput: '3', isHidden: true, explanation: 'Negative numbers handled' }
    ]
  },
  {
    id: 'algo-two-sum',
    title: 'Two Sum - Target Pair Indices',
    difficulty: 'Medium',
    marks: 10,
    description: 'Given an array of integers `nums` and an integer `target`, return indices of the two numbers such that they add up to `target` (0-indexed, sorted ascending).\n\nYou may assume that each input has exactly one solution, and you may not use the same element twice. Output the two space-separated indices.',
    constraints: [
      '2 <= nums.length <= 10^4',
      '-10^9 <= nums[i] <= 10^9',
      '-10^9 <= target <= 10^9'
    ],
    examples: [
      { input: '4 9\n2 7 11 15', output: '0 1', explanation: 'nums[0] + nums[1] == 9, output "0 1"' },
      { input: '3 6\n3 2 4', output: '1 2', explanation: 'nums[1] + nums[2] == 6, output "1 2"' }
    ],
    starterCode: {
      c: `// C (GCC) - Two Sum\n#include <stdio.h>\n#include <stdlib.h>\nvoid twoSum(int* nums, int n, int target) {}\nint main() { return 0; }`,
      cpp: `// C++ (G++) - Two Sum\n#include <iostream>\n#include <vector>\nusing namespace std;\nvoid twoSum(vector<int>& nums, int target) {}\nint main() { return 0; }`,
      java: `// Java (OpenJDK) - Two Sum\nimport java.util.*;\npublic class Solution {\n    public static void twoSum(int[] nums, int target) {}\n    public static void main(String[] args) {}\n}`,
      python: `# Python 3 - Two Sum\nimport sys\ndef two_sum(nums, target):\n    pass\nif __name__ == '__main__':\n    pass`,
      typescript: `// TypeScript - Two Sum\nexport function twoSum(nums: number[], target: number): void {}`
    },
    testCases: [
      { id: 'tc-ts1', input: '4 9\n2 7 11 15', expectedOutput: '0 1', isHidden: false },
      { id: 'tc-ts2', input: '3 6\n3 2 4', expectedOutput: '1 2', isHidden: false },
      { id: 'tc-ts3', input: '2 6\n3 3', expectedOutput: '0 1', isHidden: true },
      { id: 'tc-ts4', input: '5 -8\n-3 4 3 90 -5', expectedOutput: '0 4', isHidden: true }
    ]
  },
  {
    id: 'algo-max-subarray',
    title: 'Maximum Subarray Sum (Kadane)',
    difficulty: 'Medium',
    marks: 10,
    description: 'Given an integer array `nums`, find the subarray with the largest sum, and return its sum.\n\nA subarray is a contiguous non-empty sequence of elements within an array.',
    constraints: [
      '1 <= nums.length <= 10^5',
      '-10^4 <= nums[i] <= 10^4'
    ],
    examples: [
      { input: '9\n-2 1 -3 4 -1 2 1 -5 4', output: '6', explanation: 'The subarray [4,-1,2,1] has the largest sum 6.' }
    ],
    starterCode: {
      c: `// C (GCC)\n#include <stdio.h>\nint main() { return 0; }`,
      cpp: `// C++ (G++)\n#include <iostream>\nusing namespace std;\nint main() { return 0; }`,
      java: `// Java\nimport java.util.*;\npublic class Solution { public static void main(String[] args) {} }`,
      python: `# Python 3\nimport sys`,
      typescript: `// TypeScript`
    },
    testCases: [
      { id: 'tc-k1', input: '9\n-2 1 -3 4 -1 2 1 -5 4', expectedOutput: '6', isHidden: false },
      { id: 'tc-k2', input: '1\n1', expectedOutput: '1', isHidden: false },
      { id: 'tc-k3', input: '5\n5 4 -1 7 8', expectedOutput: '23', isHidden: true },
      { id: 'tc-k4', input: '4\n-5 -2 -7 -1', expectedOutput: '-1', isHidden: true }
    ]
  },
  {
    id: 'algo-valid-parentheses',
    title: 'Valid Bracket Sequences',
    difficulty: 'Medium',
    marks: 10,
    description: 'Given a string `s` containing just the characters `(`, `)`, `{`, `}`, `[` and `]`, determine if the input string is valid.',
    constraints: [
      '1 <= s.length <= 10^4',
      's consists of parentheses only: ()[]{}'
    ],
    examples: [
      { input: '()[]{}', output: 'true', explanation: 'All matching' }
    ],
    starterCode: {
      c: `// C\n#include <stdio.h>\nint main() { return 0; }`,
      cpp: `// C++\n#include <iostream>\nusing namespace std;\nint main() { return 0; }`,
      java: `// Java\nimport java.util.*;\npublic class Solution { public static void main(String[] args) {} }`,
      python: `# Python 3\nimport sys`,
      typescript: `// TypeScript`
    },
    testCases: [
      { id: 'tc-p1', input: '()[]{}', expectedOutput: 'true', isHidden: false },
      { id: 'tc-p2', input: '(]', expectedOutput: 'false', isHidden: false },
      { id: 'tc-p3', input: '([)]', expectedOutput: 'false', isHidden: true },
      { id: 'tc-p4', input: '{[()()]}', expectedOutput: 'true', isHidden: true }
    ]
  },
  {
    id: 'algo-longest-substring',
    title: 'Longest Substring Without Repeating Characters',
    difficulty: 'Medium',
    marks: 10,
    description: 'Given a string `s`, find the length of the longest substring without repeating characters.',
    constraints: [
      '0 <= s.length <= 5 * 10^4',
      's consists of English letters, digits, symbols and spaces.'
    ],
    examples: [
      { input: 'abcabcbb', output: '3' },
      { input: 'bbbbb', output: '1' }
    ],
    starterCode: {
      c: `// C\n#include <stdio.h>\nint main() { return 0; }`,
      cpp: `// C++\n#include <iostream>\nusing namespace std;\nint main() { return 0; }`,
      java: `// Java\nimport java.util.*;\npublic class Solution { public static void main(String[] args) {} }`,
      python: `# Python 3\nimport sys`,
      typescript: `// TypeScript`
    },
    testCases: [
      { id: 'tc-s1', input: 'abcabcbb', expectedOutput: '3', isHidden: false },
      { id: 'tc-s2', input: 'bbbbb', expectedOutput: '1', isHidden: false },
      { id: 'tc-s3', input: 'pwwkew', expectedOutput: '3', isHidden: true },
      { id: 'tc-s4', input: 'dvdf', expectedOutput: '3', isHidden: true }
    ]
  }
];

function seededRandom(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  return function() {
    hash = (hash * 9301 + 49297) % 233280;
    return Math.abs(hash / 233280);
  };
}

function shuffle<T>(array: T[], rng: () => number): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function getCandidateAssessmentQuestions(
  candidateIdOrEmail: string,
  aptitudeBank: AptitudeQuestion[] = APTITUDE_QUESTION_BANK,
  codingBank: CodingQuestion[] = CODING_QUESTION_BANK
): {
  aptitudeQuestions: AptitudeQuestion[];
  codingQuestions: CodingQuestion[];
} {
  const dateSeed = new Date().toISOString().slice(0, 10);
  const rng = seededRandom(candidateIdOrEmail + '_' + dateSeed);

  const shuffledAptitude = shuffle(aptitudeBank, rng);
  const selectedAptitude = shuffledAptitude.slice(0, Math.min(8, shuffledAptitude.length));

  const shuffledCoding = shuffle(codingBank, rng);
  const selectedCoding = shuffledCoding.slice(0, Math.min(2, shuffledCoding.length));

  const codingMarks = selectedCoding.length * 10;
  const totalAptitudeMarks = Math.max(0, 100 - codingMarks);

  if (selectedAptitude.length > 0) {
    const base = Math.floor(totalAptitudeMarks / selectedAptitude.length);
    const rem = totalAptitudeMarks % selectedAptitude.length;
    selectedAptitude.forEach((q, i) => {
      q.marks = base + (i < rem ? 1 : 0);
    });
  }

  return {
    aptitudeQuestions: selectedAptitude,
    codingQuestions: selectedCoding
  };
}
