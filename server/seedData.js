export const categorySeed = [
  { name: '高等数学', children: ['函数与极限', '一元微积分', '多元微积分'] },
  { name: '线性代数', children: ['行列式', '矩阵', '向量空间'] },
  { name: '概率论', children: ['随机事件', '随机变量'] },
  { name: '计算机基础', children: ['数据结构', '算法分析'] },
];

export const tagSeed = [
  '基础',
  '计算',
  '核心概念',
  '易错题',
  '综合',
  '证明',
  '函数',
  '极限',
  '导数',
  '积分',
  '矩阵',
  '行列式',
  '特征值',
  '概率',
  '算法',
];

export const questionSeed = [
  {
    title: '函数求值：二次函数',
    type: 'single',
    difficulty: 'easy',
    categoryPath: ['高等数学', '函数与极限'],
    tags: ['函数', '基础'],
    stemMarkdown: String.raw`已知函数 $f(x)=x^{2}-1$，则 $f(2)$ 的值为（ ）。`,
    options: [
      { id: 'A', text: '2' },
      { id: 'B', text: '3' },
      { id: 'C', text: '4' },
      { id: 'D', text: '5' },
    ],
    answer: { optionId: 'B' },
    analysisMarkdown: String.raw`将 $x=2$ 代入函数：

$$f(2)=2^{2}-1=4-1=3$$

因此选择 **B**。`,
  },
  {
    title: '基础极限：正弦函数除以 x',
    type: 'fill',
    difficulty: 'medium',
    categoryPath: ['高等数学', '函数与极限'],
    tags: ['极限', '计算'],
    stemMarkdown: String.raw`计算极限：

$$\lim_{x\to 0}\frac{\sin 3x}{x} = \underline{\qquad}$$

结果填在下方输入框中。`,
    judgeConfig: {
      blanks: [{ placeholder: '输入极限值' }],
      caseSensitive: false,
      trimWhitespace: true,
      collapseWhitespace: false,
    },
    answer: { blanks: [['3', '3.0']] },
    analysisMarkdown: String.raw`利用重要极限 $\lim_{t\to 0}\frac{\sin t}{t}=1$：

$$\frac{\sin 3x}{x}=3\cdot\frac{\sin 3x}{3x}\to 3\cdot 1=3$$

所以答案为 **3**。`,
  },
  {
    title: '连续与可导的关系',
    type: 'truefalse',
    difficulty: 'medium',
    categoryPath: ['高等数学'],
    tags: ['核心概念', '易错题'],
    stemMarkdown: `判断下列说法是否正确：

> 若函数在某点连续，则它在该点一定可导。`,
    answer: { value: false },
    analysisMarkdown: String.raw`不一定。经典反例是 $f(x)=|x|$ 在 $x=0$ 处：

- 函数连续；
- 左导数不存在（左右导数不相等），因此不可导。

可导一定连续，但连续不一定可导。`,
  },
  {
    title: '求导：幂函数',
    type: 'fill',
    difficulty: 'easy',
    categoryPath: ['高等数学', '一元微积分'],
    tags: ['导数', '计算'],
    stemMarkdown: String.raw`已知 $f(x)=x^{3}$，求导得 $f'(x)=$ ______。`,
    judgeConfig: {
      blanks: [{ placeholder: '输入导函数' }],
      caseSensitive: false,
      trimWhitespace: true,
      collapseWhitespace: true,
    },
    answer: { blanks: [['3x^2', '3x²', '3*x^2']] },
    analysisMarkdown: String.raw`使用幂函数求导公式：

$$\frac{d}{dx}x^{n}=nx^{n-1}$$

因此 $f'(x)=3x^{2}$。`,
  },
  {
    title: '定积分计算',
    type: 'single',
    difficulty: 'medium',
    categoryPath: ['高等数学', '一元微积分'],
    tags: ['积分', '计算'],
    stemMarkdown: String.raw`计算定积分：

$$\int_{0}^{1}x^{2}\,dx$$

选择正确结果。`,
    options: [
      { id: 'A', text: String.raw`$\dfrac{1}{4}$` },
      { id: 'B', text: String.raw`$\dfrac{1}{3}$` },
      { id: 'C', text: String.raw`$\dfrac{1}{2}$` },
      { id: 'D', text: String.raw`$\dfrac{2}{3}$` },
    ],
    answer: { optionId: 'B' },
    analysisMarkdown: String.raw`由牛顿–莱布尼茨公式：

$$\int_{0}^{1}x^{2}\,dx=\left[\frac{x^{3}}{3}\right]_{0}^{1}=\frac{1}{3}$$

所以选择 **B**。`,
  },
  {
    title: '级数敛散性判断',
    type: 'multiple',
    difficulty: 'hard',
    categoryPath: ['高等数学', '一元微积分'],
    tags: ['极限', '综合'],
    stemMarkdown: `关于下列级数的敛散性，哪些结论是正确的？（多选）`,
    options: [
      { id: 'A', text: String.raw`$\displaystyle\sum_{n=1}^{\infty}\frac{1}{n}$ 收敛` },
      { id: 'B', text: String.raw`$\displaystyle\sum_{n=1}^{\infty}\frac{1}{n^{2}}$ 收敛` },
      { id: 'C', text: String.raw`$\displaystyle\sum_{n=1}^{\infty}\left(\frac{1}{2}\right)^{n}$ 收敛` },
      { id: 'D', text: String.raw`$\displaystyle\sum_{n=1}^{\infty}\frac{(-1)^{n}}{n}$ 发散` },
    ],
    answer: { optionIds: ['B', 'C'] },
    analysisMarkdown: `逐项判断：

1. A 是调和级数，发散。
2. B 是 $p=2$ 的 $p$-级数，收敛。
3. C 是公比为 $\\frac12$ 的几何级数，收敛。
4. D 是交错调和级数，由莱布尼茨判别法可知收敛。

因此正确选项为 **B、C**。`,
  },
  {
    title: '偏导数计算',
    type: 'fill',
    difficulty: 'medium',
    categoryPath: ['高等数学', '多元微积分'],
    tags: ['计算', '导数'],
    stemMarkdown: String.raw`已知 $z=x^{2}y+y^{3}$，则 $\dfrac{\partial z}{\partial x}=$ ______。`,
    judgeConfig: {
      blanks: [{ placeholder: '输入关于 x 的偏导数' }],
      caseSensitive: false,
      trimWhitespace: true,
      collapseWhitespace: true,
    },
    answer: { blanks: [['2xy', '2*x*y', '2yx']] },
    analysisMarkdown: String.raw`对 $x$ 求偏导时，把 $y$ 视为常数：

$$\frac{\partial z}{\partial x}=2xy$$

$y^{3}$ 与 $x$ 无关，因此导数为 0。`,
  },
  {
    title: '矩阵可逆的等价条件',
    type: 'multiple',
    difficulty: 'medium',
    categoryPath: ['线性代数', '矩阵'],
    tags: ['矩阵', '核心概念'],
    stemMarkdown: `设 $A$ 为 $n$ 阶方阵。下列哪些条件与「$A$ 可逆」等价？（多选）`,
    options: [
      { id: 'A', text: String.raw`$\det(A)\neq 0$` },
      { id: 'B', text: String.raw`齐次方程 $Ax=0$ 只有零解` },
      { id: 'C', text: String.raw`存在同阶方阵 $B$，使得 $AB=I$` },
      { id: 'D', text: String.raw`$\operatorname{rank}(A)<n$` },
    ],
    answer: { optionIds: ['A', 'B', 'C'] },
    analysisMarkdown: `对于 $n$ 阶方阵，可逆、行列式非零、满秩、齐次方程只有零解、存在右逆矩阵都互为等价条件。

D 项秩小于 $n$ 时行列式为 0，矩阵不可逆。正确答案：**A、B、C**。`,
  },
  {
    title: '行列式的换行性质',
    type: 'truefalse',
    difficulty: 'easy',
    categoryPath: ['线性代数', '行列式'],
    tags: ['行列式', '基础'],
    stemMarkdown: `判断：

> 交换行列式的任意两行，行列式的值保持不变。`,
    answer: { value: false },
    analysisMarkdown: `错误。交换行列式的两行（或两列），行列式变号：

$$D'=-D$$

例如二阶单位矩阵的行列式为 1，交换两行后行列式为 -1。`,
  },
  {
    title: '上三角矩阵的特征值',
    type: 'single',
    difficulty: 'medium',
    categoryPath: ['线性代数', '矩阵'],
    tags: ['特征值', '矩阵'],
    stemMarkdown: String.raw`矩阵

$$A=\begin{pmatrix}2&1\\0&3\end{pmatrix}$$

的特征值为（ ）。`,
    options: [
      { id: 'A', text: '0 和 5' },
      { id: 'B', text: '1 和 2' },
      { id: 'C', text: '2 和 3' },
      { id: 'D', text: '-1 和 3' },
    ],
    answer: { optionId: 'C' },
    analysisMarkdown: String.raw`上三角矩阵的特征值就是主对角线元素：

$$\lambda_1=2,\qquad \lambda_2=3$$

因此选择 **C**。也可以通过解 $|A-\lambda I|=0$ 验证。`,
  },
  {
    title: '线性相关的定义与秩判别',
    type: 'essay',
    difficulty: 'hard',
    categoryPath: ['线性代数', '向量空间'],
    tags: ['证明', '核心概念'],
    stemMarkdown: `请用自己的语言回答：

1. 什么是向量组的线性相关？
2. 如何用矩阵的秩判断一个向量组是否线性相关？`,
    answer: {
      referenceMarkdown: `**线性相关的定义**

存在一组不全为零的系数 $k_1,k_2,\\dots,k_m$，使得

$$k_1\\alpha_1+k_2\\alpha_2+\\cdots+k_m\\alpha_m=0$$

则称向量组 $\\alpha_1,\\dots,\\alpha_m$ 线性相关；若上式只有零解，则称其线性无关。

**用秩判断**

把向量组按列（或行）排成矩阵 $A$。若 $\\operatorname{rank}(A)$ 小于向量个数 $m$，则向量组线性相关；若秩等于 $m$，则线性无关。`,
    },
    analysisMarkdown: `可以从“是否存在非平凡线性组合为零”切入，再联系齐次线性方程组 $Ax=0$ 是否有非零解。`,
  },
  {
    title: '条件概率公式',
    type: 'single',
    difficulty: 'medium',
    categoryPath: ['概率论', '随机事件'],
    tags: ['概率', '计算'],
    stemMarkdown: String.raw`已知 $P(A)=0.6$，$P(B\mid A)=0.5$，则 $P(A\cap B)=$（ ）。`,
    options: [
      { id: 'A', text: '0.2' },
      { id: 'B', text: '0.3' },
      { id: 'C', text: '0.5' },
      { id: 'D', text: '0.8' },
    ],
    answer: { optionId: 'B' },
    analysisMarkdown: String.raw`由条件概率公式：

$$P(B\mid A)=\frac{P(A\cap B)}{P(A)}$$

因此

$$P(A\cap B)=P(B\mid A)P(A)=0.5\times 0.6=0.3$$

选择 **B**。`,
  },
  {
    title: '两点分布的数学期望',
    type: 'fill',
    difficulty: 'easy',
    categoryPath: ['概率论', '随机变量'],
    tags: ['概率', '计算'],
    stemMarkdown: String.raw`设随机变量 $X$ 只取 0 和 1，且

$$P(X=1)=0.3,\qquad P(X=0)=0.7$$

则 $E(X)=$ ______。`,
    judgeConfig: {
      blanks: [{ placeholder: '输入期望值' }],
      caseSensitive: false,
      trimWhitespace: true,
      collapseWhitespace: false,
    },
    answer: { blanks: [['0.3', '0.30', '3/10']] },
    analysisMarkdown: String.raw`由离散型随机变量的期望公式：

$$E(X)=\sum x_iP(X=x_i)=1\times 0.3+0\times 0.7=0.3$$`,
  },
  {
    title: '方差的取值范围',
    type: 'truefalse',
    difficulty: 'easy',
    categoryPath: ['概率论', '随机变量'],
    tags: ['核心概念', '概率'],
    stemMarkdown: `判断：

> 随机变量的方差可能为负数。`,
    answer: { value: false },
    analysisMarkdown: String.raw`方差定义为

$$\operatorname{Var}(X)=E\left[(X-E(X))^{2}\right]$$

它是非负随机变量的期望，因此方差始终满足 $\operatorname{Var}(X)\ge 0$。`,
  },
  {
    title: '算法复杂度辨析',
    type: 'multiple',
    difficulty: 'medium',
    categoryPath: ['计算机基础', '算法分析'],
    tags: ['算法', '核心概念'],
    stemMarkdown: `关于常见算法的时间复杂度，下列说法正确的有：（多选）`,
    options: [
      { id: 'A', text: '在有序数组上进行二分查找，最坏时间复杂度为 $O(\\log n)$。' },
      { id: 'B', text: '归并排序的平均时间复杂度为 $O(n\\log n)$。' },
      { id: 'C', text: '快速排序在所有输入上的最坏时间复杂度都是 $O(n\\log n)$。' },
      { id: 'D', text: '哈希表查找在任何情况下最坏都是 $O(1)$。' },
    ],
    answer: { optionIds: ['A', 'B'] },
    analysisMarkdown: `- 二分查找每次将搜索区间减半，最坏为 $O(\\log n)$。
- 归并排序稳定地达到 $O(n\\log n)$。
- 快速排序在极端划分下最坏为 $O(n^2)$。
- 哈希表在大量冲突时可能退化，最坏为 $O(n)$。

正确答案：**A、B**。`,
  },
  {
    title: '栈与队列的区别',
    type: 'essay',
    difficulty: 'medium',
    categoryPath: ['计算机基础', '数据结构'],
    tags: ['核心概念', '算法'],
    stemMarkdown: `请说明栈（Stack）与队列（Queue）的核心区别，并各举一个典型应用场景。`,
    answer: {
      referenceMarkdown: `**栈**遵循后进先出（LIFO）原则：只能在栈顶插入和删除元素。典型应用包括函数调用栈、括号匹配、表达式求值与深度优先搜索。

**队列**遵循先进先出（FIFO）原则：在队尾入队，在队头出队。典型应用包括任务调度、广度优先搜索、消息队列。`,
    },
    analysisMarkdown: `可以从操作位置、先进后出/先进先出和典型使用场景三个角度组织答案。`,
  },
  {
    title: '二分查找的复杂度',
    type: 'fill',
    difficulty: 'easy',
    categoryPath: ['计算机基础', '算法分析'],
    tags: ['算法', '计算'],
    stemMarkdown: `对长度为 $n$ 的有序数组进行二分查找，其最坏情况时间复杂度为 ______（使用大 O 记号）。`,
    judgeConfig: {
      blanks: [{ placeholder: '例如 O(...)' }],
      caseSensitive: false,
      trimWhitespace: true,
      collapseWhitespace: true,
    },
    answer: {
      blanks: [['O(log n)', 'O(log(n))', 'O(logn)', 'O(log2 n)', 'O(log_2 n)']],
    },
    analysisMarkdown: `最坏情况下，二分查找每次将待搜索区间缩小一半，最多比较

$$\\lceil \\log_2 n\\rceil + 1$$

次，因此时间复杂度为 $O(\\log n)$。`,
  },
];

export const draftQuestionSeed = {
  title: '马尔可夫链的平稳分布（草稿）',
  type: 'essay',
  difficulty: 'hard',
  categoryPath: ['概率论'],
  tags: ['概率', '综合'],
  stemMarkdown: `设离散时间马尔可夫链的转移矩阵为 $P$，平稳分布为 $\\pi$。

请回答：

1. 写出平稳分布满足的方程与归一化条件；
2. 简要说明平稳分布与极限分布的区别。`,
  answer: {
    referenceMarkdown: `平稳分布满足

$$\\pi P=\\pi,\\qquad \\sum_i\\pi_i=1,\\quad \\pi_i\\ge 0.$$

平稳分布描述“若初始分布为 $\\pi$，则经过任意一步后分布仍为 $\\pi$”。极限分布则描述从任意初始分布出发，经过 $n\\to\\infty$ 步后的极限。存在平稳分布不保证极限分布存在或唯一；不可约非周期有限状态链的平稳分布是唯一的极限分布。`,
  },
  analysisMarkdown: `本题作为后台编辑器的草稿示例，可在管理员后台编辑并发布。`,
  draftOnly: true,
};
