import { Candidate, AptitudeQuestion, CodingQuestion } from '../types';

export const INITIAL_PRE_SCREENED_CANDIDATES: Candidate[] = [
  {
    id: 'CAN-CHECK',
    name: 'Jordan Lee (Security Check)',
    email: 'candidate.check@assessment.io',
    role: 'Full Stack Software Engineer',
    accessCode: 'TEST2026CODE',
    screeningScore: 97,
    resumeSummary: 'Pre-screened verification candidate for testing malpractice, camera, and proctoring locks.',
    isPreScreened: true,
    attemptsCount: 0,
    maxAttempts: 1,
  },
  {
    id: 'CAN-DEMO',
    name: 'Alex Morgan (Demo Candidate)',
    email: 'candidate.demo@assessment.io',
    role: 'Full Stack Software Engineer',
    accessCode: 'DEMO2026TEST',
    screeningScore: 98,
    resumeSummary: 'Pre-screened demonstration candidate profile for viewing the assessment platform.',
    isPreScreened: true,
    attemptsCount: 0,
    maxAttempts: 1,
  },
  {
    id: 'CAN-8021',
    name: 'Ananya Sharma',
    email: 'ananya.s@example.com',
    role: 'Full Stack Software Engineer',
    accessCode: '482910482910',
    screeningScore: 92,
    resumeSummary: 'Passed resume screening: 4+ yrs React, Node.js, distributed systems, high ATS match.',
    isPreScreened: true,
    attemptsCount: 0,
    maxAttempts: 1,
  },
  {
    id: 'CAN-8022',
    name: 'Rahul Verma',
    email: 'rahul.v@example.com',
    role: 'Backend Systems Engineer',
    accessCode: '391820471928',
    screeningScore: 89,
    resumeSummary: 'Passed resume screening: Python, Go, microservices, PostgreSQL query optimization.',
    isPreScreened: true,
    attemptsCount: 0,
    maxAttempts: 1,
  },
  {
    id: 'CAN-8023',
    name: 'Dhanush Reddy',
    email: 'dhanushprojects123@gmail.com',
    role: 'Senior Software Engineer',
    accessCode: 'TECH-8023',
    screeningScore: 96,
    resumeSummary: 'Passed resume screening: Full-stack architecture, algorithms, cloud infrastructure.',
    isPreScreened: true,
    attemptsCount: 0,
    maxAttempts: 1,
  },
  {
    id: 'CAN-8024',
    name: 'Priya Iyer',
    email: 'priya.i@example.com',
    role: 'Frontend & UI Engineer',
    accessCode: '581920384719',
    screeningScore: 88,
    resumeSummary: 'Passed resume screening: TypeScript, web performance, component architecture.',
    isPreScreened: true,
    attemptsCount: 0,
    maxAttempts: 1,
  },
  {
    id: 'CAN-8025',
    name: 'David Miller',
    email: 'david.m@example.com',
    role: 'Cloud & DevOps Engineer',
    accessCode: '719283019283',
    screeningScore: 85,
    resumeSummary: 'Passed resume screening: Kubernetes, CI/CD pipelines, Docker, Linux internals.',
    isPreScreened: true,
    attemptsCount: 0,
    maxAttempts: 1,
  }
];

export const DEFAULT_CODING_QUESTIONS: CodingQuestion[] = [
  {
    id: 'code-q1',
    title: 'Subarray Sum Equals K',
    difficulty: 'Medium',
    marks: 10,
    description: `Given an array of integers \`nums\` and an integer \`k\`, return the total number of continuous subarrays whose sum equals to \`k\`. A subarray is a contiguous non-empty sequence of elements within an array. Your solution should ideally run in **O(n)** time complexity.`,
    constraints: [
      '1 <= nums.length <= 2 * 10^4',
      '-1000 <= nums[i] <= 1000',
      '-10^7 <= k <= 10^7'
    ],
    examples: [
      {
        input: 'nums = [1, 1, 1], k = 2',
        output: '2',
        explanation: 'The subarrays [1, 1] at indices [0, 1] and [1, 2] both sum to 2.'
      },
      {
        input: 'nums = [1, 2, 3], k = 3',
        output: '2',
        explanation: 'Subarrays [1, 2] and [3] both sum to 3.'
      }
    ],
    starterCode: {
      c: `// C (GCC) Solution\n#include <stdio.h>\n#include <stdlib.h>\n\nint subarraySum(int* nums, int numsSize, int k) {\n    int count = 0;\n    return count;\n}\n\nint main() {\n    int n, k;\n    if (scanf("%d %d", &n, &k) == 2) {\n        int* arr = (int*)malloc(sizeof(int) * n);\n        for (int i = 0; i < n; i++) scanf("%d", &arr[i]);\n        printf("%d\\n", subarraySum(arr, n, k));\n        free(arr);\n    }\n    return 0;\n}`,
      cpp: `// C++ (G++) Solution\n#include <iostream>\n#include <vector>\nusing namespace std;\n\nint subarraySum(vector<int>& nums, int k) {\n    int count = 0;\n    return count;\n}\n\nint main() {\n    int n, k;\n    if (cin >> n >> k) {\n        vector<int> nums(n);\n        for (int i = 0; i < n; i++) cin >> nums[i];\n        cout << subarraySum(nums, k) << endl;\n    }\n    return 0;\n}`,
      java: `// Java (OpenJDK 17) Solution\nimport java.util.*;\n\npublic class Solution {\n    public static int subarraySum(int[] nums, int k) {\n        int count = 0;\n        return count;\n    }\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        if (sc.hasNextInt()) {\n            int n = sc.nextInt();\n            int k = sc.nextInt();\n            int[] nums = new int[n];\n            for (int i = 0; i < n; i++) nums[i] = sc.nextInt();\n            System.out.println(subarraySum(nums, k));\n        }\n    }\n}`,
      python: `# Python 3 Solution\ndef subarraySum(nums: list, k: int) -> int:\n    count = 0\n    return count\n`,
      typescript: `// TypeScript Solution\nfunction subarraySum(nums: number[], k: number): number {\n  let count = 0;\n  return count;\n}`
    },
    testCases: [
      {
        id: 'tc-1-1',
        input: '{"nums": [1, 1, 1], "k": 2}',
        expectedOutput: '2',
        isHidden: false,
        explanation: 'Basic consecutive sum'
      },
      {
        id: 'tc-1-2',
        input: '{"nums": [1, 2, 3], "k": 3}',
        expectedOutput: '2',
        isHidden: false,
        explanation: 'Multiple non-overlapping matching subarrays'
      },
      {
        id: 'tc-1-3',
        input: '{"nums": [1, -1, 0], "k": 0}',
        expectedOutput: '3',
        isHidden: true,
        explanation: 'Hidden: Includes zero and negative integers'
      },
      {
        id: 'tc-1-4',
        input: '{"nums": [3, 4, 7, 2, -3, 1, 4, 2], "k": 7}',
        expectedOutput: '4',
        isHidden: true,
        explanation: 'Hidden: Complex array with multiple cumulative matches'
      }
    ]
  },
  {
    id: 'code-q2',
    title: 'Merge Overlapping Meeting Intervals',
    difficulty: 'Medium',
    marks: 10,
    description: `Given an array of meeting time intervals where \`intervals[i] = [start_i, end_i]\`, merge all overlapping intervals, and return an array of the non-overlapping intervals that cover all the intervals in the input. The output array should be sorted by start time.`,
    constraints: [
      '1 <= intervals.length <= 10^4',
      'intervals[i].length == 2',
      '0 <= start_i <= end_i <= 10^4'
    ],
    examples: [
      {
        input: 'intervals = [[1, 3], [2, 6], [8, 10], [15, 18]]',
        output: '[[1, 6], [8, 10], [15, 18]]',
        explanation: 'Intervals [1, 3] and [2, 6] overlap, merging them into [1, 6].'
      },
      {
        input: 'intervals = [[1, 4], [4, 5]]',
        output: '[[1, 5]]',
        explanation: 'Intervals [1, 4] and [4, 5] touch boundaries, so they merge.'
      }
    ],
    starterCode: {
      c: `// C (GCC) Solution - Merge Intervals\n#include <stdio.h>\n#include <stdlib.h>\n\nvoid mergeIntervals(int intervals[][2], int n) {}\nint main() { return 0; }`,
      cpp: `// C++ (G++) Solution - Merge Intervals\n#include <iostream>\n#include <vector>\nusing namespace std;\n\nvector<vector<int>> mergeIntervals(vector<vector<int>>& intervals) {\n    return {};\n}`,
      java: `// Java (OpenJDK 17) Solution - Merge Intervals\nimport java.util.*;\n\npublic class Solution {\n    public static int[][] mergeIntervals(int[][] intervals) {\n        return new int[0][0];\n    }\n}`,
      python: `# Python 3 Solution - Merge Intervals\ndef mergeIntervals(intervals: list) -> list:\n    return []\n`,
      typescript: `// TypeScript Solution - Merge Intervals\nfunction mergeIntervals(intervals: number[][]): number[][] {\n  return [];\n}`
    },
    testCases: [
      {
        id: 'tc-2-1',
        input: '{"intervals": [[1, 3], [2, 6], [8, 10], [15, 18]]}',
        expectedOutput: '[[1,6],[8,10],[15,18]]',
        isHidden: false,
        explanation: 'Basic overlap and separate blocks'
      },
      {
        id: 'tc-2-2',
        input: '{"intervals": [[1, 4], [4, 5]]}',
        expectedOutput: '[[1,5]]',
        isHidden: false,
        explanation: 'Touching boundary intervals'
      },
      {
        id: 'tc-2-3',
        input: '{"intervals": [[1, 10], [2, 3], [4, 8], [9, 12]]}',
        expectedOutput: '[[1,12]]',
        isHidden: true,
        explanation: 'Hidden: Enclosed and extending intervals'
      },
      {
        id: 'tc-2-4',
        input: '{"intervals": [[2, 3], [4, 5], [6, 7], [8, 9], [1, 10]]}',
        expectedOutput: '[[1,10]]',
        isHidden: true,
        explanation: 'Hidden: Unsorted intervals where last interval absorbs earlier ones'
      }
    ]
  }
];

export const DEFAULT_APTITUDE_QUESTIONS: AptitudeQuestion[] = [
  {
    id: 'apt-1',
    topic: 'Algorithmic Complexity & Hash Tables',
    question: 'In a hash table with open addressing using linear probing, what is the primary structural degradation phenomenon that occurs as the load factor exceeds 0.7?',
    options: [
      'Primary clustering, causing contiguous occupied buckets to form and increase average probe lengths.',
      'Secondary clustering, resulting from identical initial hash codes tracing identical probe sequences.',
      'Memory thrashing due to heap pointer fragmentation.',
      'Infinite recursion in tombstone collision resolution.'
    ],
    correctAnswerIndex: 0,
    explanation: 'Linear probing suffers from primary clustering because any collision immediately extends contiguous occupied slots, causing all subsequent probes hitting that region to grow longer.',
    marks: 10
  },
  {
    id: 'apt-2',
    topic: 'Concurrency & Deadlock Prevention',
    question: 'Which of the following conditions is NOT one of the four Coffman conditions necessary for a deadlock to occur in a concurrent multithreaded system?',
    options: [
      'Mutual Exclusion',
      'Hold and Wait',
      'Preemption of resources by lower-priority threads',
      'Circular Wait'
    ],
    correctAnswerIndex: 2,
    explanation: 'Deadlock requires NO PREEMPTION (resources cannot be forcibly confiscated from a thread holding them). Preemption breaks deadlock.',
    marks: 10
  },
  {
    id: 'apt-3',
    topic: 'Database ACID & Transaction Isolation',
    question: 'Under SQL ANSI standard isolation levels, which isolation level is the minimum level required to prevent "Non-Repeatable Reads" (Fuzzy Reads)?',
    options: [
      'Read Uncommitted',
      'Read Committed',
      'Repeatable Read',
      'Serializable'
    ],
    correctAnswerIndex: 2,
    explanation: 'Repeatable Read locks rows read during a transaction, preventing other transactions from updating or deleting them, thereby eliminating non-repeatable reads.',
    marks: 10
  },
  {
    id: 'apt-4',
    topic: 'Quantitative Logic & Probability',
    question: 'A distributed service has 3 redundant replica servers. Each replica independently has a 90% uptime probability (p = 0.90) at any given minute. What is the probability that the service as a whole is available (at least one replica is up)?',
    options: [
      '90.0%',
      '97.0%',
      '99.9%',
      '99.0%'
    ],
    correctAnswerIndex: 2,
    explanation: 'The probability all 3 are down = (1 - 0.9)^3 = (0.1)^3 = 0.001. Therefore, availability = 1 - 0.001 = 0.999 = 99.9%.',
    marks: 10
  },
  {
    id: 'apt-5',
    topic: 'Data Structures & Binary Search Trees',
    question: 'In a Red-Black Tree with N nodes, what is the guaranteed strict upper bound on the maximum height of the tree from root to any leaf node?',
    options: [
      'log2(N)',
      '2 * log2(N + 1)',
      '1.44 * log2(N)',
      'N / 2'
    ],
    correctAnswerIndex: 1,
    explanation: 'Because no red node can have a red child and every path has the exact same black-height, the maximum possible height is bounded by 2 * log2(N + 1).',
    marks: 10
  },
  {
    id: 'apt-6',
    topic: 'Networking & HTTP/3 Protocol Architecture',
    question: 'What fundamental architectural limitation of TCP does HTTP/3 overcome by switching its transport layer protocol to QUIC over UDP?',
    options: [
      'Head-of-Line (HoL) blocking at the transport layer when a single packet is lost across multiplexed streams.',
      'Inability to perform SSL/TLS cryptographic handshakes.',
      'Maximum segment size (MSS) ceiling of 576 bytes in WAN routing.',
      'Lack of bidirectional streaming support in modern web browsers.'
    ],
    correctAnswerIndex: 0,
    explanation: 'HTTP/2 multiplexed streams over a single TCP connection, meaning one lost packet stalled all concurrent streams (TCP Head-of-Line blocking). QUIC isolates stream packet recovery.',
    marks: 10
  },
  {
    id: 'apt-7',
    topic: 'System Architecture & Distributed Caching',
    question: 'In a distributed caching layer utilizing Consistent Hashing with virtual nodes (tokens), what is the primary benefit of introducing virtual nodes?',
    options: [
      'Enables transactional two-phase commit across all cache shards.',
      'Achieves a more uniform key distribution and avoids hotspots on heterogeneous physical servers.',
      'Eliminates the need for an internal binary search lookup ring.',
      'Converts O(log N) lookup time into guaranteed O(1) hardware-level hashing.'
    ],
    correctAnswerIndex: 1,
    explanation: 'Virtual nodes map each physical cache machine to multiple points on the hash ring, preventing non-uniform hash clump distributions and hot spots.',
    marks: 10
  },
  {
    id: 'apt-8',
    topic: 'Logic Deduction & Graph Algorithms',
    question: 'Consider a directed graph G. You need to determine whether a valid build dependency order exists. Which algorithm efficiently identifies whether a cycle exists and outputs the order in O(V + E) time?',
    options: [
      'Dijkstra\'s shortest path algorithm',
      'Topological Sort using Kahn\'s Algorithm (In-degree queue) or Tarjan\'s algorithm',
      'Prim\'s Minimum Spanning Tree algorithm',
      'Bellman-Ford negative cycle relaxation algorithm'
    ],
    correctAnswerIndex: 1,
    explanation: 'Topological sorting (Kahn\'s algorithm using in-degree or DFS post-order traversal) verifies whether a Directed Acyclic Graph has dependencies and outputs the resolution sequence in O(V + E).',
    marks: 10
  }
];
