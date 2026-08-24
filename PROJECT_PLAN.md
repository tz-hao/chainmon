# ChainMon 链游开发方案｜交给 DeepSeek 执行

## 一、项目目标

开发一款类似宝可梦核心玩法的 Web3 链游，暂定名称：

**ChainMon**

核心玩法：

**探索 → 遇怪 → 捕捉 → 培养 → 组队 → 3v3 战斗 → 进化 → NFT 资产化**

第一版以 Web MVP 为目标，不做大型开放世界，不发行 Token，不做 DAO、公会、土地等复杂系统。

---

# 二、第一阶段 MVP 功能

第一版只完成以下功能：

### 1. 玩家系统

支持：

* 邮箱 / 钱包登录
* 创建玩家账号
* 创建训练师昵称
* 查看个人信息
* 查看拥有的怪物

---

### 2. 怪物系统

第一版创建：

**20 种怪物**

包含 4 种属性：

* Fire
* Water
* Nature
* Electric

每只怪物包含：

```ts
interface Monster {
  id: string
  tokenId?: string

  speciesId: number
  name: string

  element:
    | "fire"
    | "water"
    | "nature"
    | "electric"

  rarity:
    | "common"
    | "rare"
    | "epic"
    | "legendary"

  level: number
  exp: number

  hp: number
  attack: number
  defense: number
  speed: number

  skills: Skill[]

  owner: string

  generation: number

  parents?: {
    father?: string
    mother?: string
  }

  battleCount: number
  wins: number
}
```

怪物第一版可以先使用静态图片。

---

# 三、属性克制

实现基础属性系统：

```text
Fire > Nature

Nature > Water

Water > Fire

Electric > Water
```

克制：

```text
1.5x damage
```

被克制：

```text
0.75x damage
```

普通：

```text
1.0x damage
```

---

# 四、探索系统

制作一个简单地图页面：

```text
Forest
Lake
Volcano
Power Plant
```

不同地图出现不同属性怪物。

例如：

```text
Forest

Nature 60%
Fire 10%
Water 20%
Electric 10%
```

玩家点击：

```text
Explore
```

随机触发：

```text
You encountered a Wild LeafCat!
```

然后进入捕捉页面。

---

# 五、捕捉系统

捕捉概率由以下参数决定：

```text
怪物稀有度
怪物当前 HP
捕捉球等级
随机数
```

例如：

```ts
captureRate =
baseRate *
hpModifier *
ballModifier
```

成功：

```text
Monster Captured
```

失败：

```text
Monster Escaped
```

成功之后：

加入玩家 Monster Collection。

---

# 六、战斗系统

第一版使用：

# 3v3 回合制战斗

玩家选择最多三只怪物。

战斗操作：

```text
Attack

Skill

Defend

Switch
```

每个怪物拥有：

```text
HP
Attack
Defense
Speed
```

速度决定行动顺序。

伤害公式：

```text
damage =
(skillPower * attack / defense)
* elementMultiplier
* randomFactor
```

randomFactor：

```text
0.9 ~ 1.1
```

胜利：

获得：

```text
EXP

Gold

Item
```

---

# 七、升级系统

怪物获得经验值。

例如：

```text
Level 1 → Level 2
```

升级提高：

```text
HP

Attack

Defense

Speed
```

经验公式：

```text
requiredExp =
level * level * 100
```

---

# 八、进化系统

部分怪物拥有三阶段进化：

```text
FireCub
↓
FireWolf
↓
InfernoWolf
```

满足：

```text
等级条件
+
进化材料
```

即可进化。

例如：

```text
Level >= 20

Fire Stone x1
```

---

# 九、链上 NFT 系统

不是所有游戏数据都上链。

链上保存：

```text
Monster ownership

Species

Generation

DNA

Rarity

Evolution stage
```

链下保存：

```text
EXP

HP

Battle state

Gold

任务数据
```

NFT 使用：

```text
ERC-721
```

智能合约：

```text
MonsterNFT.sol
```

核心接口：

```solidity
mintMonster()

ownerOf()

getMonster()

evolveMonster()

transferFrom()
```

---

# 十、怪物 DNA

每个怪物生成 DNA：

```ts
interface MonsterDNA {

  attackGene: number

  defenseGene: number

  speedGene: number

  hpGene: number

  mutationGene: number

}
```

范围：

```text
0-100
```

DNA 会影响最终属性成长。

未来可以加入繁殖系统。

---

# 十一、链上历史

怪物需要形成自己的链上身份。

记录：

```text
Mint
Transfer
Evolution
Tournament Achievement
```

未来可以展示：

```text
Monster #3821

Original Trainer:
0x123...

Current Trainer:
0x456...

Battles:
132

Wins:
91

Championships:
2

Generation:
3
```

---

# 十二、Marketplace

第一版实现简单 NFT Marketplace。

用户可以：

```text
List Monster

Buy Monster

Cancel Listing
```

建议使用：

```text
ETH
```

或者：

```text
USDC
```

暂时：

**不要发行游戏 Token。**

---

# 十三、前端页面

项目页面：

```text
/

/login

/dashboard

/explore

/battle

/monsters

/monster/[id]

/team

/marketplace

/profile
```

---

# 十四、Dashboard

显示：

```text
Trainer

Wallet

Gold

Monsters

Wins

Battles
```

并提供入口：

```text
Explore

Battle

Monsters

Marketplace
```

---

# 十五、Monster 页面

显示：

```text
Monster Name

NFT ID

Level

Rarity

Element

HP

Attack

Defense

Speed

Skills

DNA

Owner

Generation
```

以及：

```text
Battle History

Evolution History

Ownership History
```

---

# 十六、推荐技术栈

Frontend：

```text
Next.js
TypeScript
Tailwind CSS
```

游戏 UI：

```text
React
```

战斗动画：

```text
Framer Motion
```

如果后面需要真正的地图移动：

```text
Phaser.js
```

钱包：

```text
wagmi
viem
```

钱包登录：

```text
Privy
```

数据库：

```text
PostgreSQL
```

ORM：

```text
Prisma
```

智能合约：

```text
Solidity
Hardhat
OpenZeppelin
```

测试链：

```text
Base Sepolia
```

正式网络后续再决定。

---

# 十七、项目目录

创建：

```text
chainmon/
```

目录：

```text
chainmon

/apps

  /web

/contracts

/packages

  /game-engine

  /monster-data

  /shared

/prisma

/docs
```

---

# 十八、游戏逻辑模块

创建独立模块：

```text
packages/game-engine
```

包括：

```text
battle.ts

capture.ts

damage.ts

experience.ts

evolution.ts

monster-generator.ts

random.ts
```

不要把核心游戏逻辑直接写进 React Component。

---

# 十九、数据库

创建：

```text
User

Trainer

Monster

MonsterSpecies

Battle

BattleMonster

Skill

Inventory

Item

MarketplaceListing
```

Prisma Schema 必须设计关系。

---

# 二十、开发顺序

DeepSeek 必须严格按照以下顺序开发。

## Phase 1

完成：

```text
Next.js 项目初始化

Tailwind

基础 UI

页面路由

数据库

Prisma
```

验收：

```text
npm run build
```

必须通过。

---

## Phase 2

完成：

```text
Monster 数据结构

20 个 Monster Species

属性系统

怪物生成器

Monster Collection
```

验收：

用户可以：

```text
查看 Monster

查看属性

查看详情
```

---

## Phase 3

完成：

```text
Explore

Encounter

Capture
```

完整链路：

```text
Explore
↓
Wild Monster
↓
Capture
↓
Monster Collection
```

---

## Phase 4

完成：

```text
Battle Engine

3v3 Battle

Skills

Damage

Element Counter
```

完整链路：

```text
Select Team
↓
Battle
↓
Victory
↓
EXP
```

---

## Phase 5

完成：

```text
Level

EXP

Evolution
```

---

## Phase 6

完成 Solidity：

```text
MonsterNFT.sol
```

实现：

```text
mint

transfer

evolve
```

并编写测试。

要求：

```text
Hardhat Tests
100% pass
```

---

## Phase 7

Web3 接入。

实现：

```text
Wallet Connect

Mint NFT

Read NFT

Transfer NFT
```

---

## Phase 8

Marketplace。

实现：

```text
List

Buy

Cancel
```

---

# 二十一、DeepSeek 工作规则

DeepSeek 每完成一个 Phase：

必须：

1. 运行测试。
2. 运行 build。
3. 修复所有报错。
4. 汇报修改文件。
5. 汇报完成内容。
6. 汇报遗留问题。
7. 等待进入下一 Phase。

禁止一次性实现全部功能。

---

# 二十二、代码要求

所有代码必须：

```text
TypeScript Strict Mode

ESLint pass

npm run build pass
```

Solidity：

```text
solc >=0.8.24
```

必须：

```text
使用 OpenZeppelin

编写单元测试

防止重入

权限控制
```

---

# 二十三、第一条给 DeepSeek 的指令

直接把下面这段发送给 DeepSeek：

你现在是 ChainMon 项目的 Lead Full-Stack + Web3 Engineer。

我要开发一款类似宝可梦核心玩法的 Web3 怪物收集游戏。

你负责整个项目的技术实现。

但是禁止一次性开发整个项目。

请严格按照我提供的 Phase 顺序逐阶段开发。

你的任务包括：

* Next.js
* TypeScript
* Tailwind
* PostgreSQL
* Prisma
* 游戏逻辑
* Solidity
* Hardhat
* wagmi
* viem
* Web3 NFT

核心游戏循环：

探索 → 遇怪 → 捕捉 → 收集 → 组队 → 3v3 战斗 → 升级 → 进化 → NFT

第一阶段不要发行 Token。

第一阶段不要制作 MMORPG。

第一阶段不要制作大型开放世界。

目标是先完成一个真正可以玩的 Web MVP。

现在只执行：

Phase 1

完成：

1. 创建项目架构。
2. Next.js + TypeScript。
3. Tailwind。
4. Prisma。
5. PostgreSQL 数据模型。
6. 基础页面。
7. Dashboard UI。
8. Monster Collection UI 空状态。
9. Explore UI 空状态。
10. Battle UI 空状态。

完成后必须运行：

npm run lint

npm run build

如果出现错误自行修复。

完成后向我输出：

A. 当前项目目录结构

B. 新增文件

C. 修改文件

D. 数据库 Schema

E. 当前完成度

F. 测试/build结果

G. 下一阶段建议

完成 Phase 1 后停止，不要继续 Phase 2。
