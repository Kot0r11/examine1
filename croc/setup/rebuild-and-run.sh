#!/usr/bin/env bash
# ============================================================
# Croc 复现：从软件编译到前后端跑通（一条命令走完）
#
# 用法：
#   $env:MSYSTEM='UCRT64'
#   & 'D:\msys64\usr\bin\bash.exe' -lc '/d/workbuddy/croc_work/rebuild-and-run.sh'
#
# 每一步的成功标志都写在注释里，跑完可以对照检查。
# ============================================================

source /d/workbuddy/croc_work/crocenv.sh
CROC=/d/workbuddy/croc_work/croc

echo
echo "############ 第 1 步：编译软件（C → RISC-V 机器码） ############"
cd "$CROC/sw" || exit 1
make SELECT_PROJECT=helloworld
# 成功标志：出现 sw/bin/helloworld.hex
ls -l bin/helloworld.hex || exit 1

echo
echo "############ 第 2 步：前端仿真（Verilator：功能对不对） ############"
cd "$CROC/verilator" || exit 1
# 如果 obj_dir_rtl 是从旧工具链搬过来的，里面的 makefile 会残留旧路径
# （表现为 No rule to make target '.../old/path/verilated.cpp'），必须重命名后重建
if [ -d obj_dir_rtl ] && grep -rql "croc_work/tools/msys64\|tools/msys64/ucrt64" obj_dir_rtl 2>/dev/null; then
    STALE="obj_dir_rtl.stale.$(date +%Y%m%d-%H%M%S)"
    echo ">>> obj_dir_rtl 里残留了旧工具链路径，重命名为 $STALE 后重新构建"
    mv obj_dir_rtl "$STALE"
fi
./run_verilator.sh --build
if [ ! -f obj_dir_rtl/Vtb_croc_soc.exe ] && [ ! -f obj_dir_rtl/Vtb_croc_soc ]; then
    # 已知问题：MSYS2 的 GCC 在 -O1/-O2/-O3 下链接会缺 libstdc++ 符号，用 -O0 重编
    echo ">>> 首次构建没产出可执行文件，改用 -O0 重新链接"
    cd obj_dir_rtl && make -f Vtb_croc_soc.mk -B OPT_FAST=-O0 OPT_GLOBAL=-O0 OPT_SLOW=-O0 -j 8
    cd ..
fi
./run_verilator.sh --run ../sw/bin/helloworld.hex
# 成功标志：日志里出现  [UART] Hello World from Croc!  和  Simulation finished: SUCCESS

echo
echo "############ 第 3 步：后端综合（Yosys：翻译成真实门电路） ############"
cd "$CROC/yosys" || exit 1
./run_synthesis.sh --synth
# 成功标志：SYNTH_EXIT=0，生成 out/croc_yosys.v 和 reports/*.rpt
ls -l out/croc_yosys.v || exit 1
grep -h "Chip area for top module" reports/croc_area.rpt
echo
echo "############ 全部完成 ############"
