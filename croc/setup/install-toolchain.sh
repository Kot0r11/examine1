#!/usr/bin/env bash
# ============================================================
# Croc 复现工具链安装脚本（在 MSYS2 里运行，可重复执行）
#
# 装什么：Verilator（前端仿真）、Yosys（后端综合）、
#         riscv64-unknown-elf-gcc（交叉编译器）、make/cmake/ninja/git/python
#
# 用法（在 Windows PowerShell 里）：
#   $env:MSYSTEM='UCRT64'
#   & 'D:\msys64\usr\bin\bash.exe' -lc '/c/Users/zhengxy/Desktop/examine1/croc/setup/install-toolchain.sh'
# ============================================================

set -u

export MSYSTEM=UCRT64
export PATH="/ucrt64/bin:$PATH"

echo "=============================================="
echo " 第 1 步：切换成清华镜像（国内下载快很多）"
echo "=============================================="

# 镜像按顺序尝试：南大（实测最快）→ 中科大 → 华为云
# 注意：清华镜像实测会返回 403，不要用
MSYS_MIRRORS='https://mirror.nju.edu.cn/msys2/msys/$arch
https://mirrors.ustc.edu.cn/msys2/msys/$arch
https://mirrors.huaweicloud.com/msys2/msys/$arch'
MINGW_MIRRORS='https://mirror.nju.edu.cn/msys2/mingw/$repo
https://mirrors.ustc.edu.cn/msys2/mingw/$repo
https://mirrors.huaweicloud.com/msys2/mingw/$repo'

for f in /etc/pacman.d/mirrorlist.msys /etc/pacman.d/mirrorlist.mingw; do
    if [ -f "$f" ] && [ ! -f "$f.bak" ]; then
        cp "$f" "$f.bak"
        echo "  已备份 $f -> $f.bak"
    fi
done

echo "$MSYS_MIRRORS"  | sed 's/^/Server = /' > /etc/pacman.d/mirrorlist.msys
echo "$MINGW_MIRRORS" | sed 's/^/Server = /' > /etc/pacman.d/mirrorlist.mingw
echo "  msys 仓库：";  sed 's/^/    /' /etc/pacman.d/mirrorlist.msys
echo "  mingw 仓库："; sed 's/^/    /' /etc/pacman.d/mirrorlist.mingw

echo
echo "=============================================="
echo " 第 2 步：更新系统（第一次会比较久）"
echo "=============================================="
pacman -Syuu --noconfirm
# 升级了 msys2-runtime 之后官方建议再跑一次，确保依赖都对齐
pacman -Syuu --noconfirm

echo
echo "=============================================="
echo " 第 3 步：安装 Croc 复现需要的工具"
echo "=============================================="
pacman -S --needed --noconfirm \
    make cmake ninja git python \
    mingw-w64-ucrt-x86_64-verilator \
    mingw-w64-ucrt-x86_64-yosys \
    mingw-w64-ucrt-x86_64-riscv64-unknown-elf-gcc \
    mingw-w64-ucrt-x86_64-lz4
# 注意：UCRT64 环境的包名前缀是 mingw-w64-ucrt-x86_64-，
# 不是 mingw-w64-ucrt64-（这个坑我踩过一次，用 pacman -Ss 确认过）
# lz4 也要单独装：Verilator 生成 FST 波形时要用它，但 MSYS2 的
# verilator 包不会自动带上，缺了会报 "lz4.h: No such file or directory"

echo
echo "=============================================="
echo " 第 4 步：自检（能打出下面这些版本号就说明装好了）"
echo "=============================================="
echo -n "  verilator  : "; verilator --version 2>/dev/null || echo "缺失"
echo -n "  yosys      : "; yosys -V 2>/dev/null | head -1 || echo "缺失"
echo -n "  riscv-gcc  : "; riscv64-unknown-elf-gcc --version 2>/dev/null | head -1 || echo "缺失"
echo -n "  make       : "; make --version 2>/dev/null | head -1 || echo "缺失"
echo -n "  cmake      : "; cmake --version 2>/dev/null | head -1 || echo "缺失"
echo -n "  ninja      : "; ninja --version 2>/dev/null || echo "缺失"

echo
echo "全部完成。"
