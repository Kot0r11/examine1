#!/usr/bin/env bash
# ============================================================
# Croc 复现环境变量（重新安装版：MSYS2 装在 D:\msys64）
#
# 用法：
#   MSYSTEM=UCRT64 /d/msys64/usr/bin/bash.exe -lc \
#     'source /d/workbuddy/croc_work/crocenv.sh; cd /d/workbuddy/croc_work/croc; ./verilator/run_verilator.sh --build'
# ============================================================

export MSYSTEM=UCRT64
export MSYS2_ROOT=/d/msys64
export CROC_WORK=/d/workbuddy/croc_work

# UCRT64 工具链 + Bender（原生 exe，外面套了路径转换 wrapper）
export PATH="/d/msys64/ucrt64/bin:/d/msys64/usr/bin:$CROC_WORK/tools/bender:/usr/bin:/bin:$PATH"

# gcc / verilator 是原生 Windows 程序，临时目录必须给 Windows 风格路径，
# 否则会报 "cannot open ... .s for writing: Permission denied"
mkdir -p "$CROC_WORK/tmp"
export TMPDIR="$CROC_WORK/tmp"
export TMP='D:/workbuddy/croc_work/tmp'
export TEMP='D:/workbuddy/croc_work/tmp'

# 进入环境时自报版本，方便确认工具都在
echo "[crocenv] verilator : $(verilator --version 2>/dev/null | head -1)"
echo "[crocenv] yosys     : $(yosys -V 2>/dev/null | head -1 | cut -c1-28)"
echo "[crocenv] riscv-gcc : $(riscv64-unknown-elf-gcc --version 2>/dev/null | head -1)"
echo "[crocenv] bender    : $(bender --version 2>/dev/null | head -1)"
