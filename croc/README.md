# Croc 论文复现（进阶挑战 · 第二项）

论文：**arXiv:2606.25673**《Croc: Training the Next Generation Chip Designers on Domain-Specific End-to-End Open Source Silicon》
项目：<https://github.com/pulp-platform/croc>（ETH Zurich 的开源 RISC-V SoC）

本目录是我**自己动手复现**的记录：环境重装、前端仿真、后端综合，以及全部证据文件。

---

## 1. 论文在讲什么（三句话）

1. **痛点**：教芯片设计要用几百万的商业 EDA 软件、还要签保密协议才能拿到工艺库，只有少数学校开得起课，多数学生只能学理论或玩 FPGA。
2. **做法**：ETH 做了一个开源的教学用 RISC-V SoC 模板（Croc），配一条**全开源**的设计流程和 130nm 开源工艺库，让任何学校都能开"真的把芯片造出来"的课。
3. **结果**：2025 年春季学期 65 名学生做了 33 个项目，30 个产出可制造版图，18 个入选流片候选，**5 颗真的送去工厂制造**；其中一颗（MLEM）已在硅片上点亮，实测 82 MHz、1.2 V 下功耗 52.3 mW。

---

## 2. 我做了什么

芯片设计是一条流水线，我跑通了其中**前端**和**后端**两段：

| 阶段 | 干什么 | 用的工具 | 我的结果 |
|---|---|---|---|
| **前端** | 在电脑里"假装芯片已经造好"，把程序灌进去看功能对不对 | Verilator | 串口打印出 `Hello World from Croc!`，仿真判定 `SUCCESS` |
| **后端** | 把 RTL 代码翻译成真实工艺库里存在的门电路，并算出面积代价 | Yosys + IHP 130nm PDK | 门级网表 31,016 个标准单元、顶层面积 1.58 mm² |
| （加分）闭环验证 | 拿综合出的**门级网表**再仿真一次，看功能有没有变 | Verilator | 同样打印 `Hello World`，**输出时刻与 RTL 仿真完全一致（3,461,800 ns）** |

最后一条是最关键的验证：它说明**综合过程没有改变电路功能**，前端和后端是自洽的。

### 前端和后端到底差在哪

| | 前端 | 后端 |
|---|---|---|
| 回答什么问题 | 设计**功能对不对** | 能不能**造出来**、代价多大 |
| 关心物理吗 | 不关心，只有 0/1 和时钟周期 | 关心，用工艺库里的真实面积、延时数据 |
| 产物 | 仿真日志、波形、`SUCCESS` | 门级网表 + 面积/寄存器/时序报告 |

为什么芯片非得先仿真：流一次片要几百万、等几个月，做错了就是废片。所以整个流程都在用软件把硬件预演到极致——**仿真不是玩具，是工业流程里必须走的一关**。

---

## 3. 关键数据

```
前端（RTL 仿真）    @  94600ns | [JTAG] Loading binary from ../sw/bin/helloworld.hex
                    @ 3461800ns | [UART] Hello World from Croc!
                    @ 3488950ns | [JTAG] Simulation finished: SUCCESS

后端（Yosys 综合）  门级网表 out/croc_yosys.v   4,494,142 字节
                    标准单元 31,016 个，触发器 4,275 个（占面积 13.22%）
                    Chip area for top module '\croc_chip': 1584752.842800 µm² ≈ 1.58 mm²
                    综合目标时钟 10 ns（100 MHz），与论文实测 82 MHz 同一量级
```

> 门级网表仿真与 RTL 仿真的 UART 输出时刻都是 **3,461,800 ns**。仿真里没有随机因素，
> 同一份 RTL 加同一份固件必然跑出同样结果——这本身就是结果可复现的证据。

---

## 4. 证据文件在哪

```
croc/
├── README.md                ← 本文件
├── 论文精读.md               ← 论文全文翻译 + 术语辞典 + 复现实录（40 KB）
├── 重装与重跑指南.md          ← 怎么从零装工具链、怎么亲手重跑（含踩坑对照表）
├── setup/                   ← 可重复执行的脚本
│   ├── install-toolchain.sh  一键安装工具链（换镜像 + pacman 装包 + 自检）
│   ├── crocenv.sh            环境变量（PATH、临时目录）
│   └── rebuild-and-run.sh    一条命令跑完：编译 → 前端仿真 → 后端综合
└── evidence/                ← 跑出来的原始证据
    ├── croc_rtl.log            前端仿真日志（Hello World + SUCCESS）
    ├── croc_netlist_yosys.log  门级网表仿真日志（闭环验证）
    ├── helloworld.hex          编译出的 RISC-V 机器码
    ├── croc_yosys.v            综合出的门级网表（4.4 MB）
    └── reports/                综合报告 8 份（面积、寄存器、时序、统计等）
```

---

## 5. 怎么重跑（三条命令）

```powershell
# 1. 装 MSYS2 基础包（41 MB，解压到 D:\msys64）
curl.exe -L --proxy http://127.0.0.1:7897 -o D:\croc_setup\msys2-base.tar.xz https://github.com/msys2/msys2-installer/releases/download/nightly-x86_64/msys2-base-x86_64-latest.tar.xz
tar.exe -xf D:\croc_setup\msys2-base.tar.xz -C "D:\"

# 2. 装工具链（Verilator / Yosys / RISC-V 编译器，脚本自动换国内镜像）
$env:MSYSTEM='UCRT64'
& 'D:\msys64\usr\bin\bash.exe' -lc '/c/Users/zhengxy/Desktop/examine1/croc/setup/install-toolchain.sh'

# 3. 一条命令跑完前端 + 后端
& 'D:\msys64\usr\bin\bash.exe' -lc '/d/workbuddy/croc_work/rebuild-and-run.sh'
```

详细步骤和报错对照表见 [重装与重跑指南.md](重装与重跑指南.md)。

---

## 6. 我踩的坑（Windows 上做这套流程的代价）

在 Windows 上跑这套流程，官方推荐的 Linux/容器路线用不了，我是在 MSYS2（一个 Windows 上的 Linux 工具环境）里硬凑出来的。主要问题：

1. **MSYS2 的包名**是 `mingw-w64-ucrt-x86_64-*`，不是看起来更顺的 `mingw-w64-ucrt64-*`
2. **清华镜像会 403 拒绝下载包文件** → 改用南京大学镜像
3. **Verilator 缺 LZ4**：生成波形要用它，但 MSYS2 的 verilator 包不自动带，要单独装
4. **Yosys 读不了 SystemVerilog**：要自己编译 `sv-elab` 插件，还改了三处源码才能编过
5. **链接时缺 `std::__cxx11::basic_string` 符号**：MSYS2 的 GCC 打包问题，用 `-O0` 重编绕开
6. **换工具链位置后旧构建目录残留旧路径**：把 `obj_dir_rtl` 改名重建即可

每个坑的完整原因和解决办法都写在 [重装与重跑指南.md](重装与重跑指南.md) 里。

---

## 7. 没做的部分（如实说明）

- **OpenROAD 布局布线、KLayout 出 GDS**：MSYS2 没有这两个包，OpenROAD 也不支持 Windows 原生构建，本机又没有 WSL/Docker。任务书要求"后端至少完成其一"，我用 **Yosys 综合**完成了后端。
- 要继续做完到 GDS，需要启用 WSL 或使用官方的 IIC-OSIC-TOOLS 容器。
