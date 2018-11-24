#!/bin/sh -e

mkdir -p $HOME/.zokrates/bin

export RUST_TOOLCHAIN=nightly-2018-06-04
export LIBSNARK_COMMIT=f7c87b88744ecfd008126d415494d9b34c4c1b20
export LIBSNARK_SOURCE_PATH=$HOME/.zokrates/libsnark-$LIBSNARK_COMMIT
export WITH_LIBSNARK=1

sudo apt-get update && sudo apt-get install -y --no-install-recommends \
    ca-certificates \
    build-essential \
    cmake \
    curl \
    libboost-dev \
    libboost-program-options-dev \
    libgmp3-dev \
    libprocps-dev \
    libssl-dev \
    pkg-config \
    python-markdown \
    git

git clone https://github.com/scipr-lab/libsnark.git $LIBSNARK_SOURCE_PATH \
    && git -C $LIBSNARK_SOURCE_PATH checkout $LIBSNARK_COMMIT \
    && git -C $LIBSNARK_SOURCE_PATH submodule update --init --recursive \

cd $HOME/.zokrates

git clone https://github.com/Zokrates/ZoKrates.git zokrates_src \
    && cd zokrates_src \
    && git checkout 00be915bac6cdd6533fb8ea69a7acc7a42f25633

curl https://sh.rustup.rs -sSf | sh -s -- --default-toolchain $RUST_TOOLCHAIN -y \
    && source $HOME/.cargo/env \
    && (cd zokrates_src;./build_release.sh) \
    && mv $HOME/.zokrates/zokrates_src/target/release/zokrates $HOME/.zokrates/bin/zokrates \
    && mv $HOME/.zokrates/zokrates_src/zokrates_cli/examples $HOME/.zokrates \
    && rustup self uninstall -y \
    && rm -rf $LIBSNARK_SOURCE_PATH $HOME/.zokrates/zokrates_src


echo 'Append this to your ~/.bashrc or ~/.zshrc'
echo 'export PATH=$HOME/.zokrates/bin:$PATH'